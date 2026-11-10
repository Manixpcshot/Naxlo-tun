package net.naxlo.android.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import go.Seq
import libv2ray.CoreCallbackHandler
import libv2ray.CoreController
import libv2ray.Libv2ray
import net.naxlo.android.MainActivity
import net.naxlo.android.R
import net.naxlo.android.core.AppState
import net.naxlo.android.core.ConfigBuilder
import net.naxlo.android.core.ConnectionState
import net.naxlo.android.core.Repo
import java.io.File

/**
 * The Android data plane: a platform VpnService (no root, no system driver)
 * whose tun fd is handed to the Xray core bound inside libv2ray.aar — the
 * same architecture the well-known Android clients use.
 *
 * Three details decide whether a connection actually works:
 *  1. the caller must have run [VpnService.prepare] and the user must have
 *     accepted the system dialog, otherwise [Builder.establish] returns null;
 *  2. the core config must contain a `tun` inbound — libv2ray passes the fd
 *     through the `xray.tun.fd` environment variable and nothing else reads
 *     the tunnel, so a SOCKS/HTTP-only config black-holes all traffic;
 *  3. the app's own sockets must bypass the tunnel
 *     ([Builder.addDisallowedApplication]) or the outbound would loop back in.
 */
class NaxloVpnService : VpnService() {

    private var tunnel: ParcelFileDescriptor? = null
    private var controller: CoreController? = null
    private var foreground = false

    private val callback = object : CoreCallbackHandler {
        override fun startup(): Long = 0
        override fun shutdown(): Long = 0
        override fun onEmitStatus(p0: Long, p1: String?): Long = 0
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CONNECT -> {
                // A service started with startForegroundService must reach
                // startForeground within a few seconds — do it before any work
                // so an unusable server can never turn into an ANR/crash.
                enterForeground()
                connect(intent.getStringExtra(EXTRA_SERVER_ID))
            }
            ACTION_DISCONNECT -> disconnect()
            else -> if (tunnel == null) stopSelf()
        }
        return START_STICKY
    }

    private fun enterForeground() {
        if (foreground) return
        try {
            val notification = buildNotification()
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            foreground = true
        } catch (t: Throwable) {
            // Notification permission or an OEM restriction: stay in the
            // background rather than killing the tunnel.
            foreground = false
        }
    }

    private fun leaveForeground() {
        if (!foreground) return
        try {
            if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
        } catch (_: Throwable) {
        }
        foreground = false
    }

    /** Copies the bundled geo assets next to the core's working directory. */
    private fun ensureCoreEnv() {
        Seq.setContext(applicationContext)
        val assetDir = File(filesDir, "assets")
        if (!assetDir.isDirectory) assetDir.mkdirs()
        try {
            assets.list("")?.forEach { name ->
                if (name.endsWith(".dat")) {
                    val target = File(assetDir, name)
                    if (!target.exists() || target.length() == 0L) {
                        assets.open(name).use { input -> target.outputStream().use { input.copyTo(it) } }
                    }
                }
            }
        } catch (_: Throwable) {
            // Routing no longer depends on geoip/geosite, so this is optional.
        }
        Libv2ray.initCoreEnv(assetDir.absolutePath, "")
    }

    private fun connect(serverId: String?) {
        if (tunnel != null) return
        val servers = Repo.state.servers.filter { it.supported }
        val server = servers.firstOrNull { it.id == serverId }
            ?: servers.firstOrNull { it.id == Repo.state.selectedServerId }
            ?: servers.firstOrNull()
        if (server == null) {
            fail(getString(R.string.vpn_no_server))
            return
        }
        AppState.setConnection(ConnectionState.STARTING)
        try {
            ensureCoreEnv()
            val builder = Builder()
                .setSession(getString(R.string.app_name))
                .addAddress("10.213.0.2", 32)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("1.1.1.1")
                .addDnsServer("8.8.8.8")
                .setMtu(MTU)
                .setConfigureIntent(
                    PendingIntent.getActivity(
                        this,
                        0,
                        Intent(this, MainActivity::class.java),
                        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                    )
                )
            // The core's own sockets must not re-enter the tunnel.
            try {
                builder.addDisallowedApplication(packageName)
            } catch (_: Throwable) {
            }
            val fd = builder.establish()
            if (fd == null) {
                // The user never accepted the system VPN dialog (or revoked it).
                fail(getString(R.string.vpn_denied))
                return
            }
            tunnel = fd
            val config = ConfigBuilder.buildVpn(server, MTU)
            val core = Libv2ray.newCoreController(callback)
            controller = core
            // gomobile throws when the Go side returns an error.
            core.startLoop(config, fd.fd)
            AppState.setConnection(ConnectionState.CONNECTED)
            AppState.setActiveServerName(server.name)
        } catch (t: Throwable) {
            // Never surface raw core messages: they can contain server details.
            fail(getString(R.string.vpn_failed) + " (" + t.javaClass.simpleName + ")")
        }
    }

    private fun fail(message: String) {
        AppState.setConnection(ConnectionState.ERROR, message)
        AppState.setActiveServerName(null)
        cleanup()
        leaveForeground()
        stopSelf()
    }

    private fun cleanup() {
        try {
            controller?.stopLoop()
        } catch (_: Throwable) {
        }
        controller = null
        try {
            tunnel?.close()
        } catch (_: Throwable) {
        }
        tunnel = null
    }

    private fun disconnect() {
        AppState.setConnection(ConnectionState.STOPPING)
        cleanup()
        AppState.setConnection(ConnectionState.IDLE)
        AppState.setActiveServerName(null)
        leaveForeground()
        stopSelf()
    }

    override fun onRevoke() {
        disconnect()
    }

    override fun onDestroy() {
        if (tunnel != null) disconnect() else leaveForeground()
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        // Channels only exist from API 26; minSdk is 24, so keep both paths.
        val builder = if (Build.VERSION.SDK_INT >= 26) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, getString(R.string.vpn_channel), NotificationManager.IMPORTANCE_LOW)
            )
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this).setPriority(Notification.PRIORITY_LOW)
        }
        return builder
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.vpn_notification))
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentIntent(
                PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
            )
            .setOngoing(true)
            .build()
    }

    companion object {
        const val ACTION_CONNECT = "net.naxlo.android.CONNECT"
        const val ACTION_DISCONNECT = "net.naxlo.android.DISCONNECT"
        const val EXTRA_SERVER_ID = "server_id"
        private const val CHANNEL_ID = "naxlo_vpn"
        private const val NOTIFICATION_ID = 1080
        private const val MTU = 1500
    }
}
