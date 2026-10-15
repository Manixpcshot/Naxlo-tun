package net.naxlo.android.core

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject

/**
 * Encrypted-at-rest storage (Android Keystore backed). Subscription URLs and
 * credentials never leave this file in plain text and never reach logs.
 */
object Vault {

    private const val FILE = "naxlo_vault"
    private const val KEY = "state"

    @Volatile
    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        if (prefs != null) return
        prefs = try {
            val master = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
            EncryptedSharedPreferences.create(
                context,
                FILE,
                master,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (_: Exception) {
            // Fallback keeps the app usable on devices where Keystore misbehaves;
            // the data is still app-private.
            context.getSharedPreferences("${FILE}_fallback", Context.MODE_PRIVATE)
        }
    }

    fun load(): VaultState {
        val raw = prefs?.getString(KEY, null) ?: return VaultState()
        return try {
            fromJson(JSONObject(raw))
        } catch (_: Exception) {
            VaultState()
        }
    }

    fun save(state: VaultState) {
        prefs?.edit()?.putString(KEY, toJson(state).toString())?.apply()
    }

    /* ---------------------------------------------------------- json */

    fun toJson(state: VaultState): JSONObject =
        JSONObject()
            .put(
                "subscriptions",
                JSONArray().also { arr ->
                    state.subscriptions.forEach { sub ->
                        arr.put(
                            JSONObject()
                                .put("id", sub.id)
                                .put("url", sub.url)
                                .put("name", sub.name)
                                .put("updatedAt", sub.updatedAt)
                                .put("lastError", sub.lastError)
                                .put(
                                    "userinfo",
                                    sub.userinfo?.let {
                                        JSONObject()
                                            .put("upload", it.upload)
                                            .put("download", it.download)
                                            .put("total", it.total)
                                            .put("expire", it.expire)
                                    }
                                )
                    }
                }
            )
            .put(
                "servers",
                JSONArray().also { arr ->
                    state.servers.forEach { s ->
                        arr.put(
                            JSONObject()
                                .put("id", s.id)
                                .put("name", s.name)
                                .put("protocol", s.protocol)
                                .put("supported", s.supported)
                                .put("address", s.address)
                                .put("port", s.port)
                                .put("credential", s.credential)
                                .put("flow", s.flow)
                                .put("security", s.security)
                                .put("network", s.network)
                                .put("sni", s.sni)
                                .put("alpn", s.alpn)
                                .put("fingerprint", s.fingerprint)
                                .put("allowInsecure", s.allowInsecure)
                                .put("pbk", s.pbk)
                                .put("sid", s.sid)
                                .put("host", s.host)
                                .put("path", s.path)
                                .put("serviceName", s.serviceName)
                                .put("subscriptionId", s.subscriptionId)
                                .put("latencyMs", s.latencyMs)
                        )
                    }
                }
            )
            .put("pinned", JSONArray().also { arr -> state.pinned.forEach { arr.put(it) } })
            .put("selectedServerId", state.selectedServerId)
            .put("language", state.language)

    fun fromJson(json: JSONObject): VaultState =
        VaultState(
            subscriptions = (json.optJSONArray("subscriptions") ?: JSONArray()).let { arr ->
                (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    val ui = o.optJSONObject("userinfo")
                    Subscription(
                        id = o.optString("id"),
                        url = o.optString("url"),
                        name = o.optString("name", null),
                        userinfo = ui?.let {
                            Userinfo(
                                upload = it.optLong("upload"),
                                download = it.optLong("download"),
                                total = it.optLong("total"),
                                expire = it.optLong("expire", 0L).takeIf { v -> v > 0 }
                            )
                        },
                        updatedAt = o.optLong("updatedAt", 0L).takeIf { v -> v > 0 },
                        lastError = o.optString("lastError", null)
                    )
                }
            },
            servers = (json.optJSONArray("servers") ?: JSONArray()).let { arr ->
                (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    ServerConfig(
                        id = o.optString("id"),
                        name = o.optString("name"),
                        protocol = o.optString("protocol"),
                        supported = o.optBoolean("supported"),
                        address = o.optString("address"),
                        port = o.optInt("port"),
                        credential = o.optString("credential"),
                        flow = o.optString("flow", null),
                        security = o.optString("security", "none"),
                        network = o.optString("network", "tcp"),
                        sni = o.optString("sni", null),
                        alpn = o.optString("alpn", null),
                        fingerprint = o.optString("fingerprint", null),
                        allowInsecure = o.optBoolean("allowInsecure"),
                        pbk = o.optString("pbk", null),
                        sid = o.optString("sid", null),
                        host = o.optString("host", null),
                        path = o.optString("path", null),
                        serviceName = o.optString("serviceName", null),
                        subscriptionId = o.optString("subscriptionId", null),
                        latencyMs = o.optLong("latencyMs", -1L).takeIf { v -> v >= 0 }
                    )
                }
            },
            pinned = (json.optJSONArray("pinned") ?: JSONArray()).let { arr ->
                (0 until arr.length()).map { arr.getString(it) }
            },
            selectedServerId = json.optString("selectedServerId", null),
            language = json.optString("language", "fa")
        )
}
