package net.naxlo.android.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
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

    fun init() {
        state = Vault.load()
    }

    fun update(transform: (VaultState) -> VaultState) {
        state = transform(state)
        Vault.save(state)
        AppState.bumpRevision()
    }

    fun subscriptionIdFor(url: String): String =
        MessageDigest.getInstance("SHA-256").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }.take(12)

    data class FetchReport(val total: Int, val supported: Int, val merged: Int)

    suspend fun refresh(subscriptionId: String): FetchReport = withContext(Dispatchers.IO) {
        val sub = state.subscriptions.firstOrNull { it.id == subscriptionId }
            ?: error("subscription not found")
        val connection = URL(sub.url).openConnection() as HttpURLConnection
        connection.connectTimeout = 20000
        connection.readTimeout = 20000
        connection.setRequestProperty("User-Agent", "naxlo-android/1.4")
        connection.setRequestProperty("Accept", "text/plain, application/octet-stream, */*")
        try {
            val code = connection.responseCode
            if (code !in 200..299) error("HTTP $code")
            val raw = connection.inputStream.readBytes().toString(Charsets.UTF_8)
            val userinfo = Parse.parseUserinfo(connection.getHeaderField("subscription-userinfo"))
            val title = Parse.parseProfileTitle(connection.getHeaderField("profile-title"))

            val asText = raw.trim()
            val decoded = Parse.tryDecodeBase64(asText)
            val body = when {
                Regex("(?im)^(vless|vmess|trojan|ss|hy2|tuic)://").containsMatchIn(asText) -> asText
                decoded != null && Regex("(?im)^(vless|vmess|trojan|ss|hy2|tuic)://").containsMatchIn(decoded) -> decoded
                else -> decoded ?: asText
            }

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
            FetchReport(total = (servers + kept).size, supported = (servers + kept).count { it.supported }, merged = servers.size)
        } catch (e: Exception) {
            update { current ->
                current.copy(
                    subscriptions = current.subscriptions.map { existing ->
                        if (existing.id == subscriptionId) existing.copy(lastError = e.message) else existing
                    }
                )
            }
            throw e
        } finally {
            connection.disconnect()
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
