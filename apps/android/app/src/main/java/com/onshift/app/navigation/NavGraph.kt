package com.onshift.app.navigation

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.onshift.app.data.UserPreferencesRepository
import com.onshift.app.data.model.UserPreferences
import com.onshift.app.data.model.VerificationLevel
import com.onshift.app.data.model.Worker
import com.onshift.app.ui.screens.*
import kotlinx.coroutines.launch

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Identity : Screen("identity")
    object Evidence : Screen("evidence")
    object Reconciliation : Screen("reconciliation")
    object SelectiveDisclosure : Screen("selective_disclosure")
    object GovernmentSchemes : Screen("schemes")
    object Credential : Screen("credential")
    object Privacy : Screen("privacy")
    object Verification : Screen("verification")
    object Profile : Screen("profile")
    object LanguageSelection : Screen("language_selection")
    object PlatformSelection : Screen("platform_selection")
    object IdentityOnboarding : Screen("identity_onboarding")
}

@OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
@Composable
fun AppNavGraph(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    windowSizeClass: WindowSizeClass? = null,
    startDestination: String = Screen.Home.route
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val repository = remember { UserPreferencesRepository(context.applicationContext) }
    val userPreferences by repository.userPreferencesFlow.collectAsState(initial = UserPreferences())

    val effectiveWindowSizeClass = windowSizeClass ?: WindowSizeClass.calculateFromSize(DpSize(400.dp, 800.dp))

    // Instantiating the exact data models required by HomeScreen
    val currentVerificationLevel = VerificationLevel.entries.firstOrNull() ?: VerificationLevel.values().first()
    val defaultWorker = Worker(
        id = "OS-DEMO-001",
        verificationLevel = currentVerificationLevel
    )

    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier
    ) {
        // Onboarding Sequence: Language -> Identity -> Platform Selection -> Home
        composable(Screen.LanguageSelection.route) {
            LanguageSelectionScreen(
                onLanguageSelected = { lang ->
                    coroutineScope.launch {
                        repository.updateLanguage(lang)
                        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(lang))
                        navController.navigate(Screen.IdentityOnboarding.route)
                    }
                }
            )
        }
        composable(Screen.IdentityOnboarding.route) {
            IdentityScreen(
                isOnboarding = true,
                onCompleteOnboarding = {
                    navController.navigate(Screen.PlatformSelection.route)
                }
            )
        }
        composable(Screen.PlatformSelection.route) {
            PlatformSelectionScreen(
                initialSelections = userPreferences.selectedPlatforms,
                showBackButton = true,
                onBack = { navController.popBackStack() },
                onPlatformsSelected = { platforms ->
                    coroutineScope.launch {
                        repository.updateSelectedPlatforms(platforms)
                        repository.setOnboardingCompleted(true)
                        navController.navigate(Screen.Home.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                }
            )
        }

        // Main Tab Screens
        composable(Screen.Home.route) {
            HomeScreen(
                windowSizeClass = effectiveWindowSizeClass,
                worker = defaultWorker,
                reconciliationResult = null,
                userPrefs = userPreferences
            )
        }
        composable(Screen.Identity.route) {
            IdentityScreen()
        }
        composable(Screen.Evidence.route) {
            EvidenceScreen()
        }
        composable(Screen.Reconciliation.route) {
            ReconciliationScreen()
        }
        composable(Screen.SelectiveDisclosure.route) {
            SelectiveDisclosureScreen(
                onGenerateCredential = {
                    navController.navigate(Screen.Credential.route)
                }
            )
        }
        composable(Screen.GovernmentSchemes.route) {
            GovernmentSchemesScreen(
                schemeMatches = com.onshift.app.data.model.MockData.mockSchemeMatches,
                onRestartDemo = {
                    coroutineScope.launch {
                        repository.clearPreferences()
                        navController.navigate(Screen.LanguageSelection.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                }
            )
        }
        // Credential Tab starts at SelectiveDisclosureScreen checklist, then pushes forward to CredentialScreen
        composable(Screen.Credential.route) {
            var isGenerated by remember { mutableStateOf(false) }
            var selectedClaims by remember { mutableStateOf<List<String>>(emptyList()) }
            if (!isGenerated) {
                SelectiveDisclosureScreen(
                    onClaimsSelected = { claims -> selectedClaims = claims },
                    onGenerateCredential = { isGenerated = true }
                )
            } else {
                CredentialScreen(
                    disclosedClaims = selectedClaims,
                    onBackToClaims = { isGenerated = false }
                )
            }
        }
        composable(Screen.Privacy.route) {
            PrivacyScreen()
        }
        composable(Screen.Verification.route) {
            VerificationScreen()
        }
        composable(Screen.Profile.route) {
            ProfileScreen(
                onRestartDemo = {
                    coroutineScope.launch {
                        repository.clearPreferences()
                        navController.navigate(Screen.LanguageSelection.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                }
            )
        }
    }
}