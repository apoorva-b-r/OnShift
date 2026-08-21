package com.onshift.app.navigation

import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.onshift.app.ui.screens.HomeScreen
import com.onshift.app.ui.screens.IdentityScreen
import com.onshift.app.ui.screens.EvidenceScreen
import com.onshift.app.ui.screens.ReconciliationScreen
import com.onshift.app.ui.screens.SelectiveDisclosureScreen
import com.onshift.app.ui.screens.GovernmentSchemesScreen
import com.onshift.app.ui.screens.CredentialScreen
import com.onshift.app.ui.screens.PrivacyScreen
import com.onshift.app.ui.screens.VerificationScreen

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

@Composable
fun AppNavGraph(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    windowSizeClass: WindowSizeClass? = null
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Home.route,
        modifier = modifier
    ) {
        composable(Screen.Home.route) {
            HomeScreen()
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
            GovernmentSchemesScreen()
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