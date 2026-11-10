package net.naxlo.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
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

/**
 * Day theme: the same accent and hierarchy on a light surface. Opt-in from
 * Settings — `dark` stays the default so the shipped look is unchanged.
 */
private val NaxloLight = lightColorScheme(
    primary = Color(0xFF0E7490),
    onPrimary = Color(0xFFFFFFFF),
    secondary = Color(0xFF0369A1),
    background = Color(0xFFF4F6FA),
    onBackground = Color(0xFF10151F),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF10151F),
    surfaceVariant = Color(0xFFE8ECF3),
    onSurfaceVariant = Color(0xFF4A5568),
    outline = Color(0xFFC3CBD8),
    error = Color(0xFFB91C1C)
)

@Composable
fun NaxloTheme(day: Boolean = false, content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (day) NaxloLight else NaxloDark, content = content)
}
