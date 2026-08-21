package com.onshift.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = Primary,
    secondary = Secondary,
    background = Background,
    surface = Surface,
    onPrimary = Surface,
    onSecondary = Surface,
    onBackground = OnBackground,
    onSurface = OnSurface
)

@Composable
fun OnShiftTheme(
    language: String = "en",
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = getAppTypography(language),
        content = content
    )
}
