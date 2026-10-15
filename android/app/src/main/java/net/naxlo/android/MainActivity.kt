package net.naxlo.android

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import net.naxlo.android.core.Repo
import net.naxlo.android.ui.AppShell

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(Repo.state.language))
        setContentView(androidx.compose.ui.platform.ComposeView(this).apply {
            setContent { AppShell() }
        })
    }
}
