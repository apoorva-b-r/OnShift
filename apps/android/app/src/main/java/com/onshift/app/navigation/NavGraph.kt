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
import com.onshift.app.data.PrivacyRepository
import com.onshift.app.data.UserPreferencesRepository
import com.onshift.app.data.model.UserPreferences
import com.onshift.app.data.model.VerificationLevel
import com.onshift.app.data.model.Worker
import androidx.lifecycle.viewmodel.compose.viewModel
import com.onshift.app.ui.screens.*
import com.onshift.app.ui.viewmodel.GovernmentSchemesViewModel
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
    object SignUp : Screen("sign_up")
    object SignIn : Screen("sign_in")
    object PhoneOtp : Screen("phone_otp")
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
        // Onboarding Sequence: Language -> SignUp -> SignIn -> PhoneOtp -> Identity -> Platform Selection -> Home
        composable(Screen.LanguageSelection.route) {
            LanguageSelectionScreen(
                onLanguageSelected = { lang ->
                    coroutineScope.launch {
                        repository.updateLanguage(lang)
                        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(lang))
                        navController.navigate(Screen.SignUp.route)
                    }
                }
            )
        }
        composable(Screen.SignUp.route) {
            SignUpScreen(
                onSignUpComplete = { fullName, phone, dob, gender, state, city, email, password ->
                    coroutineScope.launch {
                        val generatedWorkerId = "OS-" + (100000..999999).random()
                        repository.updateWorkerId(generatedWorkerId)
                        repository.updatePersonalDetails(
                            fullName = fullName,
                            phoneNumber = phone,
                            dateOfBirth = dob,
                            gender = gender,
                            state = state,
                            city = city,
                            email = email,
                            password = password
                        )

                        // Real Backend Integration:
                        // 1. Authenticate with dev login endpoint to acquire JWT token
                        // 2. Post worker profile document to /api/v1/workers with Bearer token
                        com.onshift.app.data.api.BackendApiClient.login(
                            id = generatedWorkerId,
                            role = "WORKER",
                            callback = object : com.onshift.app.data.api.BackendApiClient.ApiCallback<com.google.gson.JsonObject> {
                                override fun onSuccess(result: com.google.gson.JsonObject) {
                                    android.util.Log.i("BackendIntegration", "Backend login succeeded for $generatedWorkerId")
                                    com.onshift.app.data.api.BackendApiClient.createWorker(
                                        id = generatedWorkerId,
                                        name = fullName,
                                        category = "Gig Worker",
                                        location = "$city, $state",
                                        callback = object : com.onshift.app.data.api.BackendApiClient.ApiCallback<com.google.gson.JsonObject> {
                                            override fun onSuccess(res: com.google.gson.JsonObject) {
                                                android.util.Log.i("BackendIntegration", "Worker document created in MongoDB for $generatedWorkerId")
                                            }

                                            override fun onError(error: String) {
                                                android.util.Log.w("BackendIntegration", "POST /workers call failed for $generatedWorkerId: $error (falling back to local save)")
                                            }
                                        }
                                    )
                                }

                                override fun onError(error: String) {
                                    android.util.Log.w("BackendIntegration", "POST /auth/login call failed for $generatedWorkerId: $error (falling back to local save)")
                                }
                            }
                        )

                        navController.navigate(Screen.SignIn.route)
                    }
                },
                onNavigateToSignIn = {
                    navController.navigate(Screen.SignIn.route)
                }
            )
        }
        composable(Screen.SignIn.route) {
            SignInScreen(
                initialEmail = userPreferences.email,
                storedEmail = userPreferences.email,
                storedPasswordHash = userPreferences.passwordHash,
                onSignInSuccess = { emailOrId, password ->
                    coroutineScope.launch {
                        repository.setLoggedIn(true)
                        val targetWorkerId = if (userPreferences.workerId.isNotBlank()) userPreferences.workerId else "OS-DEMO-001"

                        // Real Backend Integration: Fetch JWT via POST /auth/login and configure client auth
                        com.onshift.app.data.api.BackendApiClient.login(
                            id = targetWorkerId,
                            role = "WORKER",
                            callback = object : com.onshift.app.data.api.BackendApiClient.ApiCallback<com.google.gson.JsonObject> {
                                override fun onSuccess(result: com.google.gson.JsonObject) {
                                    android.util.Log.i("BackendIntegration", "Backend login succeeded for worker $targetWorkerId")
                                }

                                override fun onError(error: String) {
                                    android.util.Log.w("BackendIntegration", "Backend login failed for $targetWorkerId: $error (falling back to local session)")
                                }
                            }
                        )

                        if (userPreferences.isPhoneVerified) {
                            navController.navigate(Screen.IdentityOnboarding.route)
                        } else {
                            navController.navigate(Screen.PhoneOtp.route)
                        }
                    }
                },
                onNavigateToSignUp = {
                    navController.navigate(Screen.SignUp.route)
                }
            )
        }
        composable(Screen.PhoneOtp.route) {
            var isVerifying by remember { mutableStateOf(false) }
            var errorMessage by remember { mutableStateOf<String?>(null) }
            val phoneNumber = if (userPreferences.phoneNumber.isNotBlank()) userPreferences.phoneNumber else "+91 98765 43210"

            LaunchedEffect(phoneNumber) {
                com.onshift.app.data.api.BackendApiClient.sendOtp(
                    phoneNumber = phoneNumber,
                    callback = object : com.onshift.app.data.api.BackendApiClient.ApiCallback<com.onshift.app.data.api.SendOtpResponse> {
                        override fun onSuccess(result: com.onshift.app.data.api.SendOtpResponse) {
                            android.util.Log.i("PhoneOtp", "Initial sendOtp triggered successfully")
                        }

                        override fun onError(error: String) {
                            android.util.Log.w("PhoneOtp", "Initial sendOtp notice: $error")
                        }
                    }
                )
            }

            PhoneOtpScreen(
                phoneNumber = phoneNumber,
                isVerifying = isVerifying,
                errorMessage = errorMessage,
                onVerify = { otp ->
                    isVerifying = true
                    errorMessage = null
                    com.onshift.app.data.api.BackendApiClient.verifyOtp(
                        phoneNumber = phoneNumber,
                        otp = otp,
                        callback = object : com.onshift.app.data.api.BackendApiClient.ApiCallback<com.onshift.app.data.api.VerifyOtpResponse> {
                            override fun onSuccess(result: com.onshift.app.data.api.VerifyOtpResponse) {
                                isVerifying = false
                                if (result.phoneVerified) {
                                    coroutineScope.launch {
                                        repository.updatePhoneVerified(true)
                                        navController.navigate(Screen.IdentityOnboarding.route) {
                                            popUpTo(Screen.PhoneOtp.route) { inclusive = true }
                                        }
                                    }
                                } else {
                                    errorMessage = "Verification failed. Please check the OTP and try again."
                                }
                            }

                            override fun onError(error: String) {
                                isVerifying = false
                                errorMessage = error
                            }
                        }
                    )
                },
                onResend = {
                    if (!isVerifying) {
                        errorMessage = null
                        com.onshift.app.data.api.BackendApiClient.sendOtp(
                            phoneNumber = phoneNumber,
                            callback = object : com.onshift.app.data.api.BackendApiClient.ApiCallback<com.onshift.app.data.api.SendOtpResponse> {
                                override fun onSuccess(result: com.onshift.app.data.api.SendOtpResponse) {
                                    android.util.Log.i("PhoneOtp", "Resend OTP triggered successfully")
                                }

                                override fun onError(error: String) {
                                    errorMessage = error
                                }
                            }
                        )
                    }
                }
            )
        }
        composable(Screen.IdentityOnboarding.route) {
            IdentityScreen(
                isOnboarding = true,
                isIdentityVerified = userPreferences.isIdentityVerified,
                workerId = if (userPreferences.workerId.isNotBlank()) userPreferences.workerId else "OS-DEMO-001",
                workerName = if (userPreferences.fullName.isNotBlank()) userPreferences.fullName else "Vikram Malhotra",
                onVerifySuccess = {
                    coroutineScope.launch {
                        repository.updateIdentityVerified(true)
                    }
                },
                onSkip = {
                    navController.navigate(Screen.PlatformSelection.route)
                },
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
                        repository.setLoggedIn(true)
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
            IdentityScreen(
                isOnboarding = false,
                isIdentityVerified = userPreferences.isIdentityVerified,
                workerId = if (userPreferences.workerId.isNotBlank()) userPreferences.workerId else "OS-DEMO-001",
                workerName = if (userPreferences.fullName.isNotBlank()) userPreferences.fullName else "Vikram Malhotra",
                onVerifySuccess = {
                    coroutineScope.launch {
                        repository.updateIdentityVerified(true)
                    }
                },
                onSkip = {
                    navController.popBackStack()
                }
            )
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
            val schemesViewModel: GovernmentSchemesViewModel = viewModel()
            LaunchedEffect(Unit) {
                schemesViewModel.fetchRecommendations()
            }
            GovernmentSchemesScreen(
                viewModel = schemesViewModel,
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
                onNavigateToIdentity = {
                    navController.navigate(Screen.Identity.route)
                },
                onRestartDemo = {
                    coroutineScope.launch {
                        PrivacyRepository.resetHashChain()
                        repository.clearPreferences()
                        navController.navigate(Screen.LanguageSelection.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                },
                onLogout = {
                    navController.navigate(Screen.SignIn.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}