package net.naxlo.android.core

import android.util.Base64
import java.net.URLDecoder
import java.security.MessageDigest

/**
 * Subscription parsing — same rules as the desktop app:
 * TXT bodies are usually Base64 of the link list; links carry the name in
 * the URI fragment; quota/title arrive as response headers.
 */
object Parse {

    private val LINK_REGEX = Regex("(vless|vmess|trojan|ss|hy2|tuic)://[^\\s\"'<>]+")

    fun extractLinks(text: String): List<String> =
        LINK_REGEX.findAll(text).map { it.value.trim() }.toList()

    fun tryDecodeBase64(text: String): String? {
        val clean = text.trim().replace("\n", "").replace("\r", "")
        if (clean.isEmpty() || !Regex("^[A-Za-z0-9+/_=\\-]+$").matches(clean)) return null
        return try {
            String(Base64.decode(clean, Base64.DEFAULT), Charsets.UTF_8)
        } catch (_: Exception) {
            null
        }
    }

    fun sha256Short(input: String): String =
        MessageDigest.getInstance("SHA-256").digest(input.toByteArray()).joinToString("") { "%02x".format(it) }.take(12)

    /** `upload=1; download=2; total=3; expire=4` → Userinfo */
    fun parseUserinfo(header: String?): Userinfo? {
        if (header.isNullOrBlank()) return null
        val values = mutableMapOf<String, Long>()
        header.split(';', ',').forEach { part ->
            val kv = part.split('=', limit = 2)
            if (kv.size == 2) kv[1].trim().toLongOrNull()?.let { values[kv[0].trim().lowercase()] = it }
        }
        if (!values.containsKey("upload") && !values.containsKey("download") && !values.containsKey("total")) return null
        return Userinfo(
            upload = values["upload"] ?: 0L,
            download = values["download"] ?: 0L,
            total = values["total"] ?: 0L,
            expire = values["expire"]?.takeIf { it > 0 }
        )
    }

    /** plain / `text:` / `base64:` profile titles */
    fun parseProfileTitle(header: String?): String? {
        var value = header?.trim().orEmpty()
        if (value.isEmpty()) return null
        try {
            value = when {
                value.startsWith("base64:", true) ->
                    String(Base64.decode(value.substring(7), Base64.DEFAULT), Charsets.UTF_8).trim()
                value.startsWith("text:", true) -> value.substring(5)
                else -> value
            }
            value = URLDecoder.decode(value, "UTF-8")
        } catch (_: Exception) {
        }
        return value.replace(Regex("[\\r\\n]+"), " ").trim().takeIf { it.isNotEmpty() }
    }

    fun parseLink(link: String, subscriptionId: String? = null): ServerConfig? {
        val withoutScheme = link.substringAfter("://")
        val fragmentAt = withoutScheme.indexOf('#')
        val body = if (fragmentAt >= 0) withoutScheme.substring(0, fragmentAt) else withoutScheme
        val name = if (fragmentAt >= 0) {
            try {
                URLDecoder.decode(withoutScheme.substring(fragmentAt + 1), "UTF-8")
            } catch (_: Exception) {
                ""
            }
        } else ""
        return when (link.substringBefore("://")) {
            "vless" -> parseVless(body, name.ifEmpty { "VLESS" }, subscriptionId)
            "trojan" -> parseTrojan(body, name.ifEmpty { "Trojan" }, subscriptionId)
            else -> ServerConfig(
                id = sha256Short(link),
                name = name.ifEmpty { link.substringBefore("://").uppercase() },
                protocol = link.substringBefore("://"),
                supported = false,
                address = "",
                port = 0,
                credential = "",
                subscriptionId = subscriptionId
            )
        }
    }

    private fun query(params: String): Map<String, String> =
        params.split('&').filter { it.contains('=') }.associate {
            val (k, v) = it.split('=', limit = 2)
            try {
                k to URLDecoder.decode(v, "UTF-8")
            } catch (_: Exception) {
                k to v
            }
        }

    private fun parseVless(body: String, name: String, subscriptionId: String?): ServerConfig? {
        val at = body.indexOf('@')
        if (at < 0) return null
        val uuid = body.substring(0, at)
        val rest = body.substring(at + 1)
        val q = rest.indexOf('?')
        val hostPort = if (q >= 0) rest.substring(0, q) else rest
        val params = if (q >= 0) query(rest.substring(q + 1)) else emptyMap()
        val hp = hostPort.split(':')
        if (hp.size != 2) return null
        val port = hp[1].toIntOrNull() ?: return null
        val security = params["security"] ?: "none"
        val network = params["type"] ?: "tcp"
        return ServerConfig(
            id = sha256Short("vless|${hp[0]}|$port|$uuid"),
            name = name,
            protocol = "vless",
            supported = true,
            address = hp[0],
            port = port,
            credential = uuid,
            flow = params["flow"]?.takeIf { it.isNotEmpty() },
            security = if (security == "xtls") "tls" else security,
            network = network,
            sni = params["sni"]?.takeIf { it.isNotEmpty() },
            alpn = params["alpn"]?.takeIf { it.isNotEmpty() },
            fingerprint = params["fp"]?.takeIf { it.isNotEmpty() },
            allowInsecure = params["allowInsecure"] == "1",
            pbk = params["pbk"]?.takeIf { it.isNotEmpty() },
            sid = params["sid"]?.takeIf { it.isNotEmpty() },
            host = params["host"]?.takeIf { it.isNotEmpty() },
            path = params["path"]?.takeIf { it.isNotEmpty() },
            serviceName = params["serviceName"]?.takeIf { it.isNotEmpty() },
            subscriptionId = subscriptionId
        )
    }

    private fun parseTrojan(body: String, name: String, subscriptionId: String?): ServerConfig? {
        val at = body.indexOf('@')
        if (at < 0) return null
        val password = body.substring(0, at)
        val rest = body.substring(at + 1)
        val q = rest.indexOf('?')
        val hostPort = if (q >= 0) rest.substring(0, q) else rest
        val params = if (q >= 0) query(rest.substring(q + 1)) else emptyMap()
        val hp = hostPort.split(':')
        if (hp.size != 2) return null
        val port = hp[1].toIntOrNull() ?: return null
        return ServerConfig(
            id = sha256Short("trojan|${hp[0]}|$port|$password"),
            name = name,
            protocol = "trojan",
            supported = true,
            address = hp[0],
            port = port,
            credential = password,
            security = params["security"] ?: "tls",
            network = params["type"] ?: "tcp",
            sni = params["sni"]?.takeIf { it.isNotEmpty() },
            alpn = params["alpn"]?.takeIf { it.isNotEmpty() },
            fingerprint = params["fp"]?.takeIf { it.isNotEmpty() },
            subscriptionId = subscriptionId
        )
    }
}
