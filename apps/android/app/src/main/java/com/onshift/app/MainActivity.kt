package com.onshift.app

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.onshift.app.data.UserPreferencesRepository
import com.onshift.app.navigation.AppNavGraph
import com.onshift.app.navigation.Screen
import com.onshift.app.ui.components.CustomBottomNavigation
import com.onshift.app.ui.theme.OnShiftTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val userPreferencesRepository = remember { UserPreferencesRepository(applicationContext) }
                    val userPreferencesState by userPreferencesRepository.userPreferencesFlow.collectAsState(initial = null)

                    val prefs = userPreferencesState
                    if (prefs == null) {
                        // Loading preferences state from DataStore
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    } else {
                        // Apply saved language locale if needed on startup
                        LaunchedEffect(prefs.language) {
                            if (prefs.language.isNotEmpty()) {
                                val currentTag = AppCompatDelegate.getApplicationLocales().toLanguageTags()
                                if (currentTag != prefs.language) {
                                    Log.d("LanguageSwitch", "Applying saved startup locale: ${prefs.language}")
                                    AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(prefs.language))
                                }
                            }
                        }

                        // Determine onboarding vs main tab start destination dynamically
                        val isNeedsOnboarding = prefs.language.isEmpty() || prefs.selectedPlatforms.isEmpty() || !prefs.onboardingCompleted
                        val startDestination = if (isNeedsOnboarding) {
                            Screen.LanguageSelection.route
                        } else {
                            Screen.Home.route
                        }

                        val navController = rememberNavController()
                        val navBackStackEntry by navController.currentBackStackEntryAsState()
                        val currentRoute = navBackStackEntry?.destination?.route

                        val mainTabRoutes = setOf(
                            Screen.Home.route,
                            Screen.Evidence.route,
                            Screen.Credential.route,
                            Screen.GovernmentSchemes.route,
                            Screen.Profile.route
                        )
                        val showBottomBar = currentRoute in mainTabRoutes

                        Scaffold(
                            bottomBar = {
                                if (showBottomBar) {
                                    CustomBottomNavigation(
                                        currentRoute = currentRoute,
                                        onTabSelected = { targetRoute ->
                                            if (currentRoute != targetRoute) {
                                                navController.navigate(targetRoute) {
                                                    popUpTo(navController.graph.findStartDestination().id) {
                                                        saveState = true
                                                    }
                                                    launchSingleTop = true
                                                    restoreState = true
                                                }
                                            }
                                        }
                                    )
                                }
                            },
                            containerColor = MaterialTheme.colorScheme.background
                        ) { innerPadding ->
                            AppNavGraph(
                                navController = navController,
                                startDestination = startDestination,
                                modifier = Modifier.padding(innerPadding)
                            )
                        }
                    }
                }
            }
        }
    }
}