package net.naxlo.android.vpn

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import net.naxlo.android.MainActivity
import net.naxlo.android.R
import net.naxlo.android.core.AppState
import net.naxlo.android.core.ConnectionState
import net.naxlo.android.core.Repo

/**
 * Quick Settings tile: one-tap connect/disconnect without opening the app.
 *
 * The tile mirrors the big power button — it connects the selected (or first
 * supported) server through [NaxloVpnService] and shows the live state. When
 * the VPN permission was never granted (or no server exists yet) it opens the
 * app instead of failing silently.
 */
class NaxloTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        updateTile()
    }

    override fun onClick() {
        super.onClick()
        val state = AppState.connection.value
        if (state == ConnectionState.CONNECTED || state == ConnectionState.STARTING) {
            startService(
                Intent(this, NaxloVpnService::class.java).setAction(NaxloVpnService.ACTION_DISCONNECT)
            )
            updateTile()
            return
        }
        val target = Repo.state.selectedServerId
            ?: Repo.state.servers.firstOrNull { it.supported }?.id
        if (target == null || VpnService.prepare(this) != null) {
            // No server yet, or the system VPN prompt was never accepted.
            openApp()
            return
        }
        val intent = Intent(this, NaxloVpnService::class.java)
            .setAction(NaxloVpnService.ACTION_CONNECT)
            .putExtra(NaxloVpnService.EXTRA_SERVER_ID, target)
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent) else startService(intent)
        updateTile()
    }

    private fun updateTile() {
        val tile = qsTile ?: return
        val connected = AppState.connection.value == ConnectionState.CONNECTED
        tile.state = if (connected) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.label = if (connected) {
            AppState.activeServerName.value ?: getString(R.string.app_name)
        } else {
            getString(R.string.app_name)
        }
        tile.updateTile()
    }

    private fun openApp() {
        val intent = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(
                PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
            )
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }

    companion object {
        /** Ask the system to re-bind the tile so it reflects the new state. */
        fun requestRefresh(context: Context) {
            try {
                requestListeningState(context, ComponentName(context, NaxloTileService::class.java))
            } catch (_: Exception) {
                // Tiles are best-effort; never crash the VPN over one.
            }
        }
    }
}
