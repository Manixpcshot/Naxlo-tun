package net.naxlo.android.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.VpnService
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
 */
class NaxloVpnService : VpnService() {

    private var tunnel: ParcelFileDescriptor? = null
    private var controller: CoreController? = null

    private val callback = object : CoreCallbackHandler {
        override fun startup(): Long = 0
        override fun shutdown(): Long = 0
        override fun onEmitStatus(p0: Long, p1: String?): Long = 0
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CONNECT -> connect(intent.getStringExtra(EXTRA_SERVER_ID))
            ACTION_DISCONNECT -> disconnect()
        }
        return START_STICKY
    }

    private fun ensureCoreEnv() {
        Seq.setContext(applicationContext)
        val assetDir = File(filesDir, "assets")
        if (!assetDir.isDirectory) assetDir.mkdirs()
        // Copy bundled geo assets next to the core's working directory.
        assets.list("")?.forEach { name ->
            if (name.endsWith(".dat")) {
                val target = File(assetDir, name)
                if (!target.exists() || target.length() == 0L) {
                    assets.open(name).use { input -> target.outputStream().use { input.copyTo(it) } }
                }
            }
        }
        Libv2ray.initCoreEnv(assetDir.absolutePath, "")
    }

    private fun connect(serverId: String?) {
        if (tunnel != null) return
        val server = Repo.state.servers.firstOrNull { it.id == (serverId ?: Repo.state.selectedServerId) }
        if (server == null || !server.supported) {
            AppState.setConnection(ConnectionState.ERROR, "no selectable server")
            stopSelf()
            return
        }
        AppState.setConnection(ConnectionState.STARTING)
        try {
            ensureCoreEnv()
            startForeground(NOTIFICATION_ID, buildNotification())
            val builder = Builder()
                .setSession("naxlo")
                .addAddress("10.213.0.2", 32)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("1.1.1.1")
                .addDnsServer("8.8.8.8")
                .setMtu(1500)
                .setConfigureIntent(
                    PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
                )
            val fd = builder.establish() ?: error("vpn tun rejected")
            tunnel = fd
            val config = ConfigBuilder.build(server)
            val core = Libv2ray.newCoreController(callback)
            controller = core
            // gomobile expects the raw tun fd; the ParcelFileDescriptor keeps it alive.
            core.startLoop(config, fd.fd)
            AppState.setConnection(ConnectionState.CONNECTED)
            AppState.setActiveServerName(server.name)
        } catch (e: Exception) {
            AppState.setConnection(ConnectionState.ERROR, e.message)
            stopSelf()
        }
    }

    private fun disconnect() {
        AppState.setConnection(ConnectionState.STOPPING)
        try {
            controller?.stopLoop()
        } catch (_: Exception) {
        }
        controller = null
        try {
            tunnel?.close()
        } catch (_: Exception) {
        }
        tunnel = null
        AppState.setConnection(ConnectionState.IDLE)
        AppState.setActiveServerName(null)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onRevoke() {
        disconnect()
    }

    override fun onDestroy() {
        if (tunnel != null) disconnect()
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(CHANNEL_ID, getString(R.string.vpn_channel), NotificationManager.IMPORTANCE_LOW)
        manager.createNotificationChannel(channel)
        return Notification.Builder(this, CHANNEL_ID)
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
    }
}
