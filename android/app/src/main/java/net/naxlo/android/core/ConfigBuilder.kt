package net.naxlo.android.core

import org.json.JSONArray
import org.json.JSONObject

/**
 * Builds the Xray JSON config for one server — the Android twin of the
 * desktop config builder: local SOCKS/HTTP inbounds plus a single outbound.
 */
object ConfigBuilder {

    fun build(server: ServerConfig, socksPort: Int = 10808, httpPort: Int = 10809): String {
        val root = JSONObject()

        val inbounds = JSONArray()
        inbounds.put(
            JSONObject()
                .put("tag", "socks")
                .put("protocol", "socks")
                .put("listen", "127.0.0.1")
                .put("port", socksPort)
                .put("settings", JSONObject().put("udp", true))
        )
        inbounds.put(
            JSONObject()
                .put("tag", "http")
                .put("protocol", "http")
                .put("listen", "127.0.0.1")
                .put("port", httpPort)
        )
        root.put("inbounds", inbounds)

        root.put("outbounds", JSONArray().put(outbound(server)).put(direct()))

        root.put(
            "routing",
            JSONObject()
                .put("domainStrategy", "AsIs")
                .put(
                    "rules",
                    JSONArray().put(
                        JSONObject()
                            .put("type", "field")
                            .put("ip", JSONArray().put("geoip:private"))
                            .put("outboundTag", "direct")
                    )
                )
        )
        return root.toString()
    }

    private fun direct(): JSONObject =
        JSONObject().put("tag", "direct").put("protocol", "freedom")

    private fun outbound(server: ServerConfig): JSONObject {
        val user = JSONObject()
            .put("id", server.credential)
            .put("level", 8)
        if (server.protocol == "vless") {
            user.put("encryption", "none")
            server.flow?.let { user.put("flow", it) }
        }
        val settings = JSONObject()
            .put(
                if (server.protocol == "vless") "vnext" else "servers",
                JSONArray().put(
                    JSONObject()
                        .put("address", server.address)
                        .put("port", server.port)
                        .put(if (server.protocol == "vless") "users" else "users", JSONArray().put(user))
                )
            )

        val outbound = JSONObject()
            .put("tag", "proxy")
            .put("protocol", server.protocol)
            .put("settings", settings)

        val stream = JSONObject().put("network", server.network)
        when (server.security) {
            "tls" -> {
                val tls = JSONObject()
                server.sni?.let { tls.put("serverName", it) }
                server.alpn?.let { tls.put("alpn", JSONArray(it.split(','))) }
                server.fingerprint?.let { tls.put("fingerprint", it) }
                if (server.allowInsecure) tls.put("allowInsecure", true)
                stream.put("security", "tls").put("tlsSettings", tls)
            }
            "reality" -> {
                val reality = JSONObject()
                server.sni?.let { reality.put("serverName", it) }
                server.fingerprint?.let { reality.put("fingerprint", it) }
                server.pbk?.let { reality.put("publicKey", it) }
                server.sid?.let { reality.put("shortId", it) }
                reality.put("spiderX", "")
                stream.put("security", "reality").put("realitySettings", reality)
            }
        }
        when (server.network) {
            "ws" -> {
                val ws = JSONObject()
                server.path?.let { ws.put("path", it) }
                val headers = JSONObject()
                server.host?.let { headers.put("Host", it) }
                if (headers.length() > 0) ws.put("headers", headers)
                stream.put("wsSettings", ws)
            }
            "grpc" -> {
                val grpc = JSONObject()
                server.serviceName?.let { grpc.put("serviceName", it) }
                stream.put("grpcSettings", grpc)
            }
        }
        outbound.put("streamSettings", stream)
        return outbound
    }
}
