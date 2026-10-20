package net.naxlo.android.core

/** Parsed proxy configuration (secrets stay in the encrypted vault only). */
data class ServerConfig(
    val id: String,
    val name: String,
    val protocol: String,
    val supported: Boolean,
    val address: String,
    val port: Int,
    val credential: String,
    val flow: String? = null,
    val security: String = "none",
    val network: String = "tcp",
    val sni: String? = null,
    val alpn: String? = null,
    val fingerprint: String? = null,
    val allowInsecure: Boolean = false,
    val pbk: String? = null,
    val sid: String? = null,
    val host: String? = null,
    val path: String? = null,
    val serviceName: String? = null,
    val subscriptionId: String? = null,
    var latencyMs: Long? = null
)

/** Traffic quota reported via the `subscription-userinfo` header. */
data class Userinfo(
    val upload: Long,
    val download: Long,
    val total: Long,
    val expire: Long?
) {
    val used: Long get() = upload + download
    val remaining: Long? get() = if (total > 0) maxOf(0, total - used) else null
    val percent: Int? get() = if (total > 0) minOf(100, ((used.toDouble() / total) * 100).toInt()) else null
}

data class Subscription(
    val id: String,
    val url: String,
    val name: String? = null,
    val userinfo: Userinfo? = null,
    val updatedAt: Long? = null,
    val lastError: String? = null,
    /** Set for subscriptions imported from a local file (content:// URI string). */
    val filePath: String? = null,
    /** Password of an encrypted ZIP import — stored encrypted, never logged. */
    val password: String? = null
)

/** Everything persisted inside EncryptedSharedPreferences. */
data class VaultState(
    val subscriptions: List<Subscription> = emptyList(),
    val servers: List<ServerConfig> = emptyList(),
    val pinned: List<String> = emptyList(),
    val selectedServerId: String? = null,
    val language: String = "fa"
)
