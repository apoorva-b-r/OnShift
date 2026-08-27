package com.onshift.app

import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.onshift.app.data.UserPreferencesRepository
import com.onshift.app.navigation.AppNavGraph
import com.onshift.app.navigation.Screen
import com.onshift.app.notifications.NotificationPermissionHelper
import com.onshift.app.ui.components.CompulsoryNotificationPermissionDialog
import com.onshift.app.ui.components.CustomBottomNavigation
import com.onshift.app.ui.theme.OnShiftTheme

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            OnShiftTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val context = LocalContext.current
                    val lifecycleOwner = LocalLifecycleOwner.current

                    var hasNotificationListenerPermission by remember {
                        mutableStateOf(NotificationPermissionHelper.isNotificationListenerGranted(context))
                    }
                    var isMockPartnerDetected by remember {
                        mutableStateOf(NotificationPermissionHelper.isMockPartnerInstalled(context) || NotificationPermissionHelper.isAnyPartnerAppInstalled(context))
                    }

                    DisposableEffect(lifecycleOwner) {
                        val observer = LifecycleEventObserver { _, event ->
                            if (event == Lifecycle.Event.ON_RESUME || event == Lifecycle.Event.ON_START) {
                                hasNotificationListenerPermission = NotificationPermissionHelper.isNotificationListenerGranted(context)
                                isMockPartnerDetected = NotificationPermissionHelper.isMockPartnerInstalled(context) || NotificationPermissionHelper.isAnyPartnerAppInstalled(context)
                            }
                        }
                        lifecycleOwner.lifecycle.addObserver(observer)
                        onDispose {
                            lifecycleOwner.lifecycle.removeObserver(observer)
                        }
                    }

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
                        val startDestination = when {
                            prefs.language.isEmpty() -> Screen.LanguageSelection.route
                            !prefs.isLoggedIn -> Screen.SignIn.route
                            !prefs.isPhoneVerified -> Screen.PhoneOtp.route
                            !prefs.onboardingCompleted -> Screen.IdentityOnboarding.route
                            else -> Screen.Home.route
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

                        Box(modifier = Modifier.fillMaxSize()) {
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

                            // Compulsory Notification Access Dialog when Mock Partner is detected and permission is not granted
                            if (isMockPartnerDetected && !hasNotificationListenerPermission) {
                                CompulsoryNotificationPermissionDialog(
                                    onEnableClicked = {
                                        NotificationPermissionHelper.openNotificationListenerSettings(context)
                                    },
                                    onOpenMockPartnerSettingsClicked = {
                                        NotificationPermissionHelper.openMockPartnerNotificationSettings(context)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}