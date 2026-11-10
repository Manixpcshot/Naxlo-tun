package net.naxlo.android.core

import org.json.JSONArray
import org.json.JSONObject

/**
 * Builds the Xray JSON config for one server — the Android twin of the
 * desktop config builder.
 *
 * Two shapes exist:
 *  - [buildVpn] for the VpnService data plane: a single `tun` inbound. The
 *    core picks the tunnel up from the `xray.tun.fd` environment variable that
 *    libv2ray's `startLoop(config, fd)` sets, so the config must not carry any
 *    local listener — a SOCKS/HTTP-only config leaves every packet the system
 *    routes into the tunnel unread, which black-holes all device traffic.
 *  - [build] for a local SOCKS/HTTP proxy (no tunnel), kept for parity with
 *    the desktop editions.
 */
object ConfigBuilder {

    /** Private/loopback/multicast ranges that must never enter the tunnel. */
    private val DIRECT_CIDRS = listOf(
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "224.0.0.0/4",
        "255.255.255.255/32",
        "::1/128",
        "fc00::/7",
        "fe80::/10",
        "ff00::/8"
    )

    /**
     * Tunnel config for [net.naxlo.android.vpn.NaxloVpnService].
     *
     * The addresses, routes and DNS servers belong to the platform VpnService
     * builder, so the core only needs the tun inbound plus routing. The private
     * ranges are listed explicitly instead of `geoip:private` so the tunnel
     * works even when the geo assets are missing or unreadable.
     */
    fun buildVpn(server: ServerConfig, mtu: Int = 1500): String {
        val root = JSONObject()
        root.put("log", JSONObject().put("loglevel", "warning"))
        root.put(
            "inbounds",
            JSONArray().put(
                JSONObject()
                    .put("tag", "tun")
                    .put("protocol", "tun")
                    .put(
                        "settings",
                        JSONObject()
                            .put("name", "naxlo0")
                            .put("mtu", mtu)
                            .put("userLevel", 8)
                    )
            )
        )
        root.put("outbounds", JSONArray().put(outbound(server)).put(direct()))
        root.put("routing", routing())
        return root.toString()
    }

    private fun routing(): JSONObject {
        val ips = JSONArray()
        DIRECT_CIDRS.forEach { ips.put(it) }
        return JSONObject()
            .put("domainStrategy", "AsIs")
            .put(
                "rules",
                JSONArray()
                    .put(
                        JSONObject()
                            .put("type", "field")
                            .put("ip", ips)
                            .put("outboundTag", "direct")
                    )
                    .put(
                        JSONObject()
                            .put("type", "field")
                            .put("network", "tcp,udp")
                            .put("outboundTag", "proxy")
                    )
            )
    }

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

        root.put("routing", routing())
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
