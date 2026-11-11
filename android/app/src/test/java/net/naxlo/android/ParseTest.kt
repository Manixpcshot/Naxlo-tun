package net.naxlo.android

import net.naxlo.android.core.Parse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ParseTest {

    @Test
    fun parsesVlessLink() {
        val link = "vless://1b6e8c2a-4f3d-4a5b-9c1e-7d2f8a6b5c4d@example.server.com:443?encryption=none&security=reality&type=grpc&pbk=SbVK&sid=ab12&fp=chrome&sni=www.microsoft.com&serviceName=x#%D8%B3%D8%B1%D9%88%D8%B1"
        val server = Parse.parseLink(link)
        assertNotNull(server)
        server!!
        assertEquals("vless", server.protocol)
        assertEquals("reality", server.security)
        assertEquals("grpc", server.network)
        assertEquals("SbVK", server.pbk)
        assertEquals("سرور", server.name)
        assertTrue(server.supported)
    }

    @Test
    fun parsesUserinfoHeader() {
        val info = Parse.parseUserinfo("upload=1073741824; download=2147483648; total=10737418240; expire=1767225600")
        assertNotNull(info)
        info!!
        assertEquals(3221225472L, info.used)
        assertEquals(7516192768L, info.remaining)
        assertEquals(30, info.percent)
        assertEquals(1767225600L, info.expire)
        assertNull(Parse.parseUserinfo(null))
        assertNull(Parse.parseUserinfo("garbage"))
    }

    @Test
    fun parsesProfileTitle() {
        assertEquals("My Plan", Parse.parseProfileTitle("My Plan"))
        assertNull(Parse.parseProfileTitle(null))
        assertNull(Parse.parseProfileTitle("   "))
    }

    @Test
    fun extractsLinksAndBase64() {
        val body = "junk vless://uuid@host:443?type=tcp#n more trojan://pw@h2:8443#t"
        assertEquals(2, Parse.extractLinks(body).size)
    }

    @Test
    fun keepsATrojanPasswordThatContainsAtSign() {
        val link = "trojan://p@ssw0rd@trojan.example.com:443?security=tls&sni=trojan.example.com&type=tcp#at"
        val server = Parse.parseLink(link)
        assertNotNull(server)
        server!!
        assertEquals("trojan", server.protocol)
        assertEquals("trojan.example.com", server.address)
        assertEquals(443, server.port)
        assertEquals("p@ssw0rd", server.credential)
        assertEquals("trojan.example.com", server.sni)
        assertTrue(server.supported)
    }

    @Test
    fun ignoresAnAtSignInsideTheQuery() {
        val link = "vless://1b6e8c2a-4f3d-4a5b-9c1e-7d2f8a6b5c4d@example.server.com:443?security=tls&type=ws&path=/@ws&sni=example.server.com#q"
        val server = Parse.parseLink(link)
        assertNotNull(server)
        server!!
        assertEquals("example.server.com", server.address)
        assertEquals(443, server.port)
        assertEquals("1b6e8c2a-4f3d-4a5b-9c1e-7d2f8a6b5c4d", server.credential)
        assertEquals("ws", server.network)
        assertEquals("/@ws", server.path)
    }
}
