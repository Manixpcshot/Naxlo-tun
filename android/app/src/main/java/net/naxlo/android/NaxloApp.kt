package net.naxlo.android

import android.app.Application
import net.naxlo.android.core.Repo
import net.naxlo.android.core.Vault

class NaxloApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Vault.init(this)
        Repo.init()
    }
}
