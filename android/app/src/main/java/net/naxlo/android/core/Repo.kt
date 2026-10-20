package net.naxlo.android.core

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import net.lingala.zip4j.ZipFile
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

enum class ConnectionState { IDLE, STARTING, CONNECTED, STOPPING, ERROR }

/** App-wide observable state (the desktop AppState, Android edition). */
object AppState {
    private val _connection = MutableStateFlow(ConnectionState.IDLE)
    val connection: StateFlow<ConnectionState> = _connection.asStateFlow()

    private val _revision = MutableStateFlow(0)
    val revision: StateFlow<Int> = _revision.asStateFlow()

    private val _latency = MutableStateFlow<Long?>(null)
    val latency: StateFlow<Long?> = _latency.asStateFlow()

    private val _activeServerName = MutableStateFlow<String?>(null)
    val activeServerName: StateFlow<String?> = _activeServerName.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun setConnection(value: ConnectionState, error: String? = null) {
        _connection.value = value
        _error.value = error
    }

    fun setLatency(value: Long?) {
        _latency.value = value
    }

    fun setActiveServerName(value: String?) {
        _activeServerName.value = value
    }

    fun bumpRevision() {
        _revision.value += 1
    }
}

/**
 * Subscription fetching + vault mutations. The raw URL is registered nowhere
 * but the encrypted vault; logs only ever see masked forms.
 */
object Repo {

    @Volatile
    var state: VaultState = VaultState()
        private set

    private lateinit var appContext: Context

    fun init(context: Context) {
        appContext = context.applicationContext
        state = Vault.load()
    }

    fun update(transform: (VaultState) -> VaultState) {
        state = transform(state)
        Vault.save(state)
        AppState.bumpRevision()
    }

    fun subscriptionIdFor(url: String): String =
        MessageDigest.getInstance("SHA-256").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }.take(12)

    data class FetchReport(
        val total: Int,
        val supported: Int,
        val merged: Int,
        /** The imported file is an encrypted ZIP — ask the user for its password. */
        val needPassword: Boolean = false,
        /** The supplied password did not decrypt the archive. */
        val wrongPassword: Boolean = false,
        /** Echoed content URI so the UI can retry the same file with a password. */
        val filePath: String? = null
    )

    suspend fun refresh(subscriptionId: String): FetchReport = withContext(Dispatchers.IO) {
        val sub = state.subscriptions.firstOrNull { it.id == subscriptionId }
            ?: error("subscription not found")
        if (!sub.filePath.isNullOrBlank()) return@withContext refreshFile(sub)
        val connection = URL(sub.url).openConnection() as HttpURLConnection
        connection.connectTimeout = 20000
        connection.readTimeout = 20000
        connection.setRequestProperty("User-Agent", "naxlo-android/1.5")
        connection.setRequestProperty("Accept", "text/plain, application/octet-stream, */*")
        try {
            val code = connection.responseCode
            if (code !in 200..299) error("HTTP $code")
            val raw = connection.inputStream.readBytes().toString(Charsets.UTF_8)
            val userinfo = Parse.parseUserinfo(connection.getHeaderField("subscription-userinfo"))
            val title = Parse.parseProfileTitle(connection.getHeaderField("profile-title"))
            ingest(subscriptionId, decodeBody(raw), userinfo, title)
        } catch (e: Exception) {
            markError(subscriptionId, e.message)
            throw e
        } finally {
            connection.disconnect()
        }
    }

    private fun decodeBody(raw: String): String {
        val asText = raw.trim()
        val decoded = Parse.tryDecodeBase64(asText)
        return when {
            Regex("(?im)^(vless|vmess|trojan|ss|hy2|tuic)://").containsMatchIn(asText) -> asText
            decoded != null && Regex("(?im)^(vless|vmess|trojan|ss|hy2|tuic)://").containsMatchIn(decoded) -> decoded
            else -> decoded ?: asText
        }
    }

    private fun markError(subscriptionId: String, message: String?) {
        update { current ->
            current.copy(
                subscriptions = current.subscriptions.map { existing ->
                    if (existing.id == subscriptionId) existing.copy(lastError = message) else existing
                }
            )
        }
    }

    /** Parse a decoded payload and replace this subscription's servers in the vault. */
    private fun ingest(subscriptionId: String, body: String, userinfo: Userinfo?, title: String?): FetchReport {
        val servers = mutableListOf<ServerConfig>()
        val seen = mutableSetOf<String>()
        Parse.extractLinks(body).forEach { link ->
            Parse.parseLink(link, subscriptionId)?.let { parsed ->
                if (seen.add(parsed.id)) servers.add(parsed)
            }
        }
        if (servers.isEmpty()) error("no configs in response")

        val previous = state.servers.associateBy { it.id }
        servers.forEach { it.latencyMs = previous[it.id]?.latencyMs }
        val kept = state.servers.filter { it.subscriptionId != subscriptionId }

        update { current ->
            current.copy(
                subscriptions = current.subscriptions.map { existing ->
                    if (existing.id == subscriptionId) {
                        existing.copy(name = title ?: existing.name, userinfo = userinfo, updatedAt = System.currentTimeMillis(), lastError = null)
                    } else existing
                },
                servers = servers + kept,
                selectedServerId = current.selectedServerId
                    ?: (servers.firstOrNull { it.supported }?.id)
            )
        }
        return FetchReport(total = (servers + kept).size, supported = (servers + kept).count { it.supported }, merged = servers.size)
    }

    /**
     * Import (or re-import) a subscription from a local file picked via SAF.
     * Supports txt/json/conf/sub and ZIP archives — including password-protected
     * ones (ZipCrypto and AES via zip4j). The password is stored in the encrypted
     * vault so the file can be refreshed without asking again.
     */
    suspend fun importFile(uriString: String, password: String?): FetchReport = withContext(Dispatchers.IO) {
        val uri = Uri.parse(uriString)
        runCatching {
            appContext.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val id = subscriptionIdFor("file:$uriString")
        val existing = state.subscriptions.firstOrNull { it.id == id }
        if (existing == null) {
            update { current ->
                current.copy(
                    subscriptions = current.subscriptions + Subscription(
                        id = id, url = "", name = displayName(uri), filePath = uriString, password = password
                    )
                )
            }
        } else if (password != null && existing.password != password) {
            update { current ->
                current.copy(
                    subscriptions = current.subscriptions.map { if (it.id == id) it.copy(password = password) else it }
                )
            }
        }
        refresh(id)
    }

    private fun displayName(uri: Uri): String? = runCatching {
        appContext.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
        }
    }.getOrNull()

    private fun refreshFile(sub: Subscription): FetchReport {
        val uri = Uri.parse(sub.filePath!!)
        val bytes = appContext.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: error("file not found")

        val body: String = if (bytes.size > 3 && bytes[0] == 0x50.toByte() && bytes[1] == 0x4b.toByte()) {
            val tmp = File(appContext.cacheDir, "naxlo-import-${sub.id}.zip")
            val outDir = File(appContext.cacheDir, "naxlo-import-${sub.id}")
            try {
                tmp.writeBytes(bytes)
                val zip = ZipFile(tmp, sub.password?.toCharArray())
                if (zip.isEncrypted && sub.password.isNullOrEmpty()) {
                    markError(sub.id, appContext.getString(net.naxlo.android.R.string.file_needs_password))
                    return FetchReport(0, 0, 0, needPassword = true, filePath = sub.filePath)
                }
                val headers = zip.fileHeaders.filter { !it.isDirectory }
                val header = headers.firstOrNull { it.fileName.matches(Regex("(?i).*\\.(txt|text|json|conf|sub)$")) }
                    ?: headers.firstOrNull { it.uncompressedSize > 0 }
                    ?: headers.firstOrNull()
                    ?: error("archive is empty")
                try {
                    zip.extractFile(header.fileName, outDir.absolutePath)
                } catch (e: Exception) {
                    if (!sub.password.isNullOrEmpty()) {
                        markError(sub.id, appContext.getString(net.naxlo.android.R.string.file_password_wrong_short))
                        return FetchReport(0, 0, 0, needPassword = true, wrongPassword = true, filePath = sub.filePath)
                    }
                    throw e
                }
                File(outDir, header.fileName).readText(Charsets.UTF_8)
            } finally {
                runCatching { tmp.delete() }
                runCatching { outDir.deleteRecursively() }
            }
        } else {
            bytes.toString(Charsets.UTF_8)
        }

        return try {
            ingest(sub.id, decodeBody(body), null, null)
        } catch (e: Exception) {
            markError(sub.id, e.message)
            throw e
        }
    }

    suspend fun addSubscription(url: String): FetchReport {
        val id = subscriptionIdFor(url)
        if (state.subscriptions.none { it.id == id }) {
            update { current ->
                current.copy(subscriptions = current.subscriptions + Subscription(id = id, url = url))
            }
        }
        return refresh(id)
    }

    fun removeSubscription(id: String) {
        update { current ->
            current.copy(
                subscriptions = current.subscriptions.filterNot { it.id == id },
                servers = current.servers.filterNot { it.subscriptionId == id }
            )
        }
    }

    fun togglePin(id: String) {
        update { current ->
            current.copy(
                pinned = if (current.pinned.contains(id)) current.pinned - id else current.pinned + id
            )
        }
    }

    fun select(id: String?) {
        update { it.copy(selectedServerId = id) }
    }

    fun setLanguage(lang: String) {
        update { it.copy(language = lang) }
    }

    /** TCP handshake latency through plain sockets (no tunnel needed). */
    suspend fun testLatency(server: ServerConfig): Long? = withContext(Dispatchers.IO) {
        val started = System.currentTimeMillis()
        try {
            java.net.Socket().use { socket ->
                socket.connect(java.net.InetSocketAddress(server.address, server.port), 4000)
                System.currentTimeMillis() - started
            }
        } catch (_: Exception) {
            null
        }
    }
}
