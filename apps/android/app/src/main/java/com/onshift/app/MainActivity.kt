package com.onshift.app

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.onshift.app.data.UserPreferencesRepository
import com.onshift.app.navigation.NavGraph
import com.onshift.app.navigation.OnboardingScreen
import com.onshift.app.ui.theme.OnShiftTheme
import kotlinx.coroutines.launch
import java.util.Locale

class MainActivity : AppCompatActivity() {
    @OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val repository = UserPreferencesRepository(applicationContext)
        
        setContent {
            val windowSizeClass = calculateWindowSizeClass(this)
            val scope = rememberCoroutineScope()
            val userPrefs by repository.userPreferencesFlow.collectAsState(initial = null)
            
            val prefs = userPrefs
            if (prefs == null) {
                // Loading state
                Box(modifier = Modifier.fillMaxSize().background(com.onshift.app.ui.theme.Background))
                return@setContent
            }

            val language = prefs.language
            val startDest = if (prefs.onboardingCompleted) "main" else OnboardingScreen.LanguageSelection.route

            // Sync AppCompatDelegate with DataStore preference
            LaunchedEffect(language) {
                val appLocale: LocaleListCompat = LocaleListCompat.forLanguageTags(language)
                if (AppCompatDelegate.getApplicationLocales().toLanguageTags() != language) {
                    AppCompatDelegate.setApplicationLocales(appLocale)
                }
            }

            OnShiftTheme(language = language) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    NavGraph(
                        startDestination = startDest,
                        windowSizeClass = windowSizeClass,
                        onLanguageChange = { newLang ->
                            scope.launch {
                                repository.updateLanguage(newLang)
                                // recreate() might cause "flashing", so we rely on Compose recomposition 
                                // and AppCompatDelegate's own recreation logic if needed.
                                // But for instant refresh of all screens, let's keep it or improve it.
                                recreate()
                            }
                        }
                    )
                }
            }
        }
    }

    private fun updateLocale(context: Context, language: String): Context {
        val locale = Locale(language)
        Locale.setDefault(locale)
        val config = Configuration(context.resources.configuration)
        config.setLocale(locale)
        return context.createConfigurationContext(config)
    }
}
