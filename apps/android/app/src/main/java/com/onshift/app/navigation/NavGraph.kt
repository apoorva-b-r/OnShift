package com.onshift.app.navigation

import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.calculateWindowSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.onshift.app.data.model.UserPreferences
import com.onshift.app.data.model.VerificationLevel
import com.onshift.app.data.model.Worker
import com.onshift.app.ui.screens.*

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
}

@OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
@Composable
fun AppNavGraph(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    windowSizeClass: WindowSizeClass? = null
) {
    val effectiveWindowSizeClass = windowSizeClass ?: WindowSizeClass.calculateFromSize(DpSize(400.dp, 800.dp))

    // Instantiating the exact data models required by HomeScreen
    val currentVerificationLevel = VerificationLevel.entries.firstOrNull() ?: VerificationLevel.values().first()
    val defaultWorker = Worker(
        id = "OS-DEMO-001",
        verificationLevel = currentVerificationLevel
    )
    val defaultPrefs = UserPreferences(
        selectedPlatforms = listOf("Zomato", "Swiggy", "Uber")
    )

    NavHost(
        navController = navController,
        startDestination = Screen.Home.route,
        modifier = modifier
    ) {
        composable(Screen.Home.route) {
            HomeScreen(
                windowSizeClass = effectiveWindowSizeClass,
                worker = defaultWorker,
                reconciliationResult = null,
                userPrefs = defaultPrefs
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
            SelectiveDisclosureScreen()
        }
        composable(Screen.GovernmentSchemes.route) {
            GovernmentSchemesScreen(
                schemeMatches = emptyList(),
                onRestartDemo = { navController.navigate(Screen.Home.route) }
            )
        }
        composable(Screen.Credential.route) {
            CredentialScreen()
        }
        composable(Screen.Privacy.route) {
            PrivacyScreen()
        }
        composable(Screen.Verification.route) {
            VerificationScreen()
        }
    }
}