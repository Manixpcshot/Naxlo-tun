package net.naxlo.android.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** The desktop design language, ported: near-black, one restrained accent. */
private val NaxloDark = darkColorScheme(
    primary = Color(0xFF22D3EE),
    onPrimary = Color(0xFF04252B),
    secondary = Color(0xFF38BDF8),
    background = Color(0xFF050505),
    onBackground = Color(0xFFE6EDF3),
    surface = Color(0xFF0D0F12),
    onSurface = Color(0xFFE6EDF3),
    surfaceVariant = Color(0xFF15181C),
    onSurfaceVariant = Color(0xFF9AA4B2),
    outline = Color(0xFF23272E),
    error = Color(0xFFF87171)
)

@Composable
fun NaxloTheme(content: @Composable () -> Unit) {
    // Naxlo is dark-only, like the desktop app.
    @Suppress("UNUSED_EXPRESSION")
    isSystemInDarkTheme()
    MaterialTheme(colorScheme = NaxloDark, content = content)
}
