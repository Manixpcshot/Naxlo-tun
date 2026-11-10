package net.naxlo.android

import net.naxlo.android.core.ConfigBuilder
import net.naxlo.android.core.Parse
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The tunnel config is what decides whether an Android connection carries any
 * traffic at all: libv2ray hands the tun fd to the core through an environment
 * variable and only a `tun` inbound reads it, so a SOCKS/HTTP-only config would
 * silently black-hole every packet the system routes into the tunnel.
 */
class ConfigBuilderTest {

    private val link = "vless://1b6e8c2a-4f3d-4a5b-9c1e-7d2f8a6b5c4d@example.server.com:443" +
        "?encryption=none&security=reality&type=grpc&pbk=SbVK&sid=ab12&fp=chrome" +
        "&sni=www.microsoft.com&serviceName=x#%D8%B3%D8%B1%D9%88%D8%B1"

    private fun server() = Parse.parseLink(link).also { assertNotNull(it) }!!

    @Test
    fun vpnConfigUsesATunInboundAndNoLocalListener() {
        val json = JSONObject(ConfigBuilder.buildVpn(server()))
        val inbounds = json.getJSONArray("inbounds")
        assertEquals(1, inbounds.length())
        val tun = inbounds.getJSONObject(0)
        assertEquals("tun", tun.getString("protocol"))
        assertEquals("tun", tun.getString("tag"))
        val settings = tun.getJSONObject("settings")
        assertEquals(1500, settings.getInt("mtu"))
        assertTrue(settings.getString("name").isNotEmpty())
        // the platform VpnService owns addresses, routes and DNS
        assertFalse(json.toString().contains("127.0.0.1"))
        assertFalse(inbounds.toString().contains("socks"))
    }

    @Test
    fun vpnConfigMtuFollowsTheBuilder() {
        val json = JSONObject(ConfigBuilder.buildVpn(server(), 1280))
        assertEquals(1280, json.getJSONArray("inbounds").getJSONObject(0).getJSONObject("settings").getInt("mtu"))
    }

    @Test
    fun vpnConfigKeepsPrivateTrafficDirectWithoutGeoAssets() {
        val json = JSONObject(ConfigBuilder.buildVpn(server()))
        val rules = json.getJSONObject("routing").getJSONArray("rules")
        val direct = rules.getJSONObject(0)
        assertEquals("direct", direct.getString("outboundTag"))
        val ips = direct.getJSONArray("ip")
        val cidrs = (0 until ips.length()).map { ips.getString(it) }
        for (expected in listOf("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "::1/128")) {
            assertTrue("missing $expected", cidrs.contains(expected))
        }
        // no dependency on geoip.dat/geosite.dat being present and valid
        assertFalse(json.toString().contains("geoip:"))
        assertFalse(json.toString().contains("geosite:"))
        assertEquals("proxy", rules.getJSONObject(1).getString("outboundTag"))
    }

    @Test
    fun vpnConfigCarriesTheServerOutbound() {
        val server = server()
        val json = JSONObject(ConfigBuilder.buildVpn(server))
        val outbounds = json.getJSONArray("outbounds")
        val proxy = outbounds.getJSONObject(0)
        assertEquals("proxy", proxy.getString("tag"))
        assertEquals("vless", proxy.getString("protocol"))
        val freedom = outbounds.getJSONObject(1)
        assertEquals("direct", freedom.getString("tag"))
        assertEquals("freedom", freedom.getString("protocol"))
        val vnext = proxy.getJSONObject("settings").getJSONArray("vnext").getJSONObject(0)
        assertEquals(server.address, vnext.getString("address"))
        assertEquals(server.port, vnext.getInt("port"))
        val user = vnext.getJSONArray("users").getJSONObject(0)
        assertEquals(server.credential, user.getString("id"))
        assertEquals("none", user.getString("encryption"))
        val stream = proxy.getJSONObject("streamSettings")
        assertEquals("grpc", stream.getString("network"))
        assertEquals("reality", stream.getString("security"))
        assertEquals("SbVK", stream.getJSONObject("realitySettings").getString("publicKey"))
        assertEquals("x", stream.getJSONObject("grpcSettings").getString("serviceName"))
    }

    @Test
    fun proxyConfigKeepsTheLocalListeners() {
        val json = JSONObject(ConfigBuilder.build(server()))
        val inbounds = json.getJSONArray("inbounds")
        val protocols = (0 until inbounds.length()).map { inbounds.getJSONObject(it).getString("protocol") }
        assertTrue(protocols.containsAll(listOf("socks", "http")))
        assertFalse(protocols.contains("tun"))
    }

    @Test
    fun websocketServerGetsPathAndHostHeader() {
        val ws = Parse.parseLink(
            "vless://1b6e8c2a-4f3d-4a5b-9c1e-7d2f8a6b5c4d@example.server.com:443" +
                "?encryption=none&security=tls&type=ws&path=%2Fray&sni=example.server.com&host=cdn.example.com#ws"
        )
        assertNotNull(ws)
        val stream = JSONObject(ConfigBuilder.buildVpn(ws!!))
            .getJSONArray("outbounds").getJSONObject(0).getJSONObject("streamSettings")
        assertEquals("tls", stream.getString("security"))
        assertEquals("/ray", stream.getJSONObject("wsSettings").getString("path"))
        val headers = stream.getJSONObject("wsSettings").getJSONObject("headers")
        assertEquals("cdn.example.com", headers.getString("Host"))
        assertEquals("example.server.com", stream.getJSONObject("tlsSettings").getString("serverName"))
    }

    @Test
    fun configsAreValidJsonArrays() {
        val json = JSONObject(ConfigBuilder.buildVpn(server()))
        assertTrue(json.get("inbounds") is JSONArray)
        assertTrue(json.get("outbounds") is JSONArray)
        assertTrue(json.get("routing") is JSONObject)
    }
}
