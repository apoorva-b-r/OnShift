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
import com.onshift.app.data.model.ReconciliationResult
import com.onshift.app.data.model.ReconciliationStatus
import com.onshift.app.data.api.BackendApiClient
import com.onshift.app.ui.screens.*
import com.onshift.app.ui.viewmodel.GovernmentSchemesViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

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
    object AccountAggregator : Screen("account_aggregator")
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
    var aaReconciliationResult by remember { mutableStateOf<ReconciliationResult?>(null) }

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
                        // 1. Authenticate with dev login endpoint to acquire server-signed JWT token & trigger MongoDB Worker upsert
                        com.onshift.app.data.api.BackendApiClient.login(
                            id = generatedWorkerId,
                            role = "WORKER",
                            name = fullName,
                            phoneNumber = phone,
                            email = email,
                            dateOfBirth = dob,
                            gender = gender,
                            state = state,
                            city = city,
                            workerCategory = "Delivery Partner",
                            callback = object : com.onshift.app.data.api.BackendApiClient.ApiCallback<com.google.gson.JsonObject> {
                                override fun onSuccess(result: com.google.gson.JsonObject) {
                                    val serverToken = result.get("token")?.asString
                                    if (!serverToken.isNullOrEmpty()) {
                                        coroutineScope.launch {
                                            repository.updateAuthToken(serverToken)
                                        }
                                    }
                                    android.util.Log.i("BackendIntegration", "Backend login succeeded for $generatedWorkerId")

                                    com.onshift.app.data.api.BackendApiClient.createWorker(
                                        id = generatedWorkerId,
                                        name = fullName,
                                        category = "Delivery Partner",
                                        location = "$city, $state",
                                        phoneNumber = phone,
                                        email = email,
                                        dateOfBirth = dob,
                                        gender = gender,
                                        state = state,
                                        city = city,
                                        callback = object : com.onshift.app.data.api.BackendApiClient.ApiCallback<com.google.gson.JsonObject> {
                                            override fun onSuccess(res: com.google.gson.JsonObject) {
                                                android.util.Log.i("BackendIntegration", "Worker document created in MongoDB for $generatedWorkerId")
                                            }

                                            override fun onError(error: String) {
                                                android.util.Log.w("BackendIntegration", "POST /workers call failed for $generatedWorkerId: $error")
                                            }
                                        }
                                    )
                                }

                                override fun onError(error: String) {
                                    android.util.Log.w("BackendIntegration", "POST /auth/login call failed for $generatedWorkerId: $error (falling back to local session)")
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
                        val targetWorkerId = if (emailOrId.startsWith("OS-", ignoreCase = true)) {
                            emailOrId
                        } else if (userPreferences.workerId.isNotBlank()) {
                            userPreferences.workerId
                        } else {
                            "OS-DEMO-001"
                        }
                        repository.updateWorkerId(targetWorkerId)

                        // Real Backend Integration: Fetch server JWT via POST /auth/login and trigger MongoDB Worker upsert
                        com.onshift.app.data.api.BackendApiClient.login(
                            id = targetWorkerId,
                            role = "WORKER",
                            name = if (userPreferences.fullName.isNotBlank()) userPreferences.fullName else "Worker $targetWorkerId",
                            phoneNumber = if (userPreferences.phoneNumber.isNotBlank()) userPreferences.phoneNumber else null,
                            email = if (userPreferences.email.isNotBlank()) userPreferences.email else null,
                            dateOfBirth = if (userPreferences.dateOfBirth.isNotBlank()) userPreferences.dateOfBirth else null,
                            gender = if (userPreferences.gender.isNotBlank()) userPreferences.gender else null,
                            state = if (userPreferences.state.isNotBlank()) userPreferences.state else null,
                            city = if (userPreferences.city.isNotBlank()) userPreferences.city else null,
                            workerCategory = "Delivery Partner",
                            callback = object : com.onshift.app.data.api.BackendApiClient.ApiCallback<com.google.gson.JsonObject> {
                                override fun onSuccess(result: com.google.gson.JsonObject) {
                                    val serverToken = result.get("token")?.asString
                                    if (!serverToken.isNullOrEmpty()) {
                                        coroutineScope.launch {
                                            repository.updateAuthToken(serverToken)
                                        }
                                    }
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
                                if (otp.trim() == "123456" && (error.contains("Network error", ignoreCase = true) || error.contains("timed out", ignoreCase = true) || error.contains("refused", ignoreCase = true))) {
                                    android.util.Log.w("PhoneOtp", "Backend unreachable ($error). Falling back to local verification for demo OTP 123456.")
                                    coroutineScope.launch {
                                        repository.updatePhoneVerified(true)
                                        navController.navigate(Screen.IdentityOnboarding.route) {
                                            popUpTo(Screen.PhoneOtp.route) { inclusive = true }
                                        }
                                    }
                                } else {
                                    errorMessage = error
                                }
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
                reconciliationResult = aaReconciliationResult,
                userPrefs = userPreferences,
                onOpenAccountAggregator = { navController.navigate(Screen.AccountAggregator.route) }
            )
        }
        composable(Screen.AccountAggregator.route) {
            com.onshift.app.ui.aa.AccountAggregatorScreen(
                onBack = { navController.popBackStack() },
                onReconciliationReady = { settlement ->
                    aaReconciliationResult = ReconciliationResult(
                        expected = settlement,
                        actual = settlement,
                        status = ReconciliationStatus.MATCHED,
                        differenceAmount = 0.0,
                        period = "2026-08-01 to 2026-08-31"
                    )
                }
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
            var credentialUiState by remember { mutableStateOf<UiState<com.onshift.app.data.model.Credential>>(UiState.Empty) }
            
            if (!isGenerated) {
                SelectiveDisclosureScreen(
                    onClaimsSelected = { claims -> selectedClaims = claims },
                    onGenerateCredential = {
                        isGenerated = true
                        credentialUiState = UiState.Loading
                        coroutineScope.launch {
                            try {
                                val workerId = BackendApiClient.getWorkerId()
                                
                                // Step 1: Check identity verification status first
                                val identityStatus = withContext(Dispatchers.IO) {
                                    try {
                                        BackendApiClient.makeSyncRequest("/identity/digilocker/status", "GET", null)
                                    } catch (e: Exception) {
                                        null
                                    }
                                }
                                
                                val identityVerified = identityStatus?.get("identityVerified")?.asBoolean ?: false
                                if (!identityVerified) {
                                    credentialUiState = UiState.Error("Identity verification required. Please complete DigiLocker verification in the Identity tab first.")
                                    return@launch
                                }
                                
                                // Step 2: Run verification to get verificationId
                                val verificationResponse = withContext(Dispatchers.IO) {
                                    BackendApiClient.runVerificationSync(workerId)
                                }
                                val verificationId = verificationResponse.get("verificationId")?.asString 
                                    ?: throw Exception("No verificationId in response")
                                
                                // Step 3: Issue credential using the verificationId
                                val credentialResponse = withContext(Dispatchers.IO) {
                                    val payload = com.google.gson.JsonObject()
                                    payload.addProperty("verificationId", verificationId)
                                    payload.addProperty("workerId", workerId)
                                    BackendApiClient.makeSyncRequest("/credentials/issue", "POST", payload)
                                }
                                
                                // Step 4: Parse the credential response
                                val credentialData = credentialResponse.getAsJsonObject("credential")
                                val verificationLevelStr = credentialData.get("verificationLevel")?.asString
                                val verificationLevel = try {
                                    verificationLevelStr?.let { 
                                        com.onshift.app.data.model.VerificationLevel.valueOf(it)
                                    }
                                } catch (e: Exception) {
                                    null
                                }
                                
                                val credential = com.onshift.app.data.model.Credential(
                                    workerId = credentialData.get("workerId")?.asString ?: workerId,
                                    period = credentialData.get("period")?.asString ?: "Unknown",
                                    verifiedIncome = credentialData.get("verifiedIncome")?.asDouble,
                                    verificationLevel = verificationLevel,
                                    signaturePreview = credentialData.get("signature")?.asString?.take(10)?.let { "0x${it}..." },
                                    includedClaims = selectedClaims
                                )
                                credentialUiState = UiState.Success(credential)
                            } catch (e: Exception) {
                                val errorMessage = when {
                                    e.message?.contains("IDENTITY_VERIFICATION_REQUIRED") == true -> 
                                        "Identity verification required. Please complete DigiLocker verification in the Identity tab first."
                                    e.message?.contains("IDENTITY_NOT_AUTHENTICATED") == true ->
                                        "DigiLocker session not authenticated. Please complete the identity verification process."
                                    e.message?.contains("VERIFICATION_NOT_FOUND") == true ->
                                        "Verification record not found. Please run the verification process first."
                                    e.message?.contains("FORBIDDEN") == true ->
                                        "Access denied. Please check your authentication status."
                                    else -> "Failed to generate credential: ${e.message}"
                                }
                                credentialUiState = UiState.Error(errorMessage)
                            }
                        }
                    }
                )
            } else {
                CredentialScreen(
                    disclosedClaims = selectedClaims,
                    onBackToClaims = { 
                        isGenerated = false
                        credentialUiState = UiState.Empty
                    },
                    uiState = credentialUiState
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