package net.naxlo.android

import android.app.Application
import net.naxlo.android.core.Repo
import net.naxlo.android.core.Vault

class NaxloApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Never let storage/keystore quirks kill the process at launch.
        try {
            Vault.init(this)
            Repo.init(this)
        } catch (_: Exception) {
            try {
                Repo.init(this)
            } catch (_: Exception) {
                // App still opens with an empty state.
            }
        }
    }
}
