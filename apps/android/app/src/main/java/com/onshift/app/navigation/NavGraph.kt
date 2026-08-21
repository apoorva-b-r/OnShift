package com.onshift.app.navigation

import androidx.compose.animation.*
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import androidx.compose.ui.zIndex
import com.onshift.app.R
import com.onshift.app.data.model.MockData
import com.onshift.app.data.model.PrivacyRecord
import com.onshift.app.ui.screens.*
import com.onshift.app.ui.theme.Primary
import com.onshift.app.ui.theme.OnSurface
import com.onshift.app.ui.theme.Background
import kotlinx.coroutines.launch

sealed class Screen(val route: String, val resourceId: Int, val icon: ImageVector) {
    object Home : Screen("home", R.string.nav_home, Icons.Default.Home)
    object Evidence : Screen("evidence", R.string.nav_evidence, Icons.AutoMirrored.Filled.List)
    object CredentialTab : Screen("credential_tab", R.string.nav_credential, Icons.Default.Badge)
    object Schemes : Screen("schemes", R.string.nav_schemes, Icons.Default.Policy)
    object Profile : Screen("profile", R.string.nav_profile, Icons.Default.Person)
}

sealed class OnboardingScreen(val route: String) {
    object LanguageSelection : OnboardingScreen("language_selection")
    object PlatformSelection : OnboardingScreen("platform_selection")
    object Identity : OnboardingScreen("identity")
}

@Composable
fun NavGraph(
    startDestination: String = OnboardingScreen.LanguageSelection.route,
    windowSizeClass: WindowSizeClass,
    onLanguageChange: (String) -> Unit
) {
    val navController = rememberNavController()
    var privacyRecord by remember { mutableStateOf(MockData.mockPrivacyRecord) }
    val context = androidx.compose.ui.platform.LocalContext.current
    val repository = remember { com.onshift.app.data.UserPreferencesRepository(context) }
    val scope = rememberCoroutineScope()
    val userPrefs by repository.userPreferencesFlow.collectAsState(initial = com.onshift.app.data.model.UserPreferences())

    NavHost(navController = navController, startDestination = startDestination) {
        composable(OnboardingScreen.LanguageSelection.route) {
            LanguageSelectionScreen(onLanguageSelected = { lang ->
                onLanguageChange(lang)
                navController.navigate(OnboardingScreen.PlatformSelection.route)
            })
        }
        composable(OnboardingScreen.PlatformSelection.route) {
            PlatformSelectionScreen(onPlatformsSelected = { platforms ->
                scope.launch {
                    repository.updateSelectedPlatforms(platforms)
                }
                navController.navigate(OnboardingScreen.Identity.route)
            })
        }
        composable(OnboardingScreen.Identity.route) {
            IdentityScreen(onNext = {
                navController.navigate("main") {
                    popUpTo(OnboardingScreen.LanguageSelection.route) { inclusive = true }
                }
            })
        }
        composable("main") {
            MainScaffold(
                windowSizeClass = windowSizeClass,
                privacyRecord = privacyRecord,
                userPrefs = userPrefs,
                onLanguageToggle = {
                    val newLang = if (userPrefs.language == "hi") "en" else "hi"
                    onLanguageChange(newLang)
                },
                onTamperDemo = {
                    privacyRecord = privacyRecord.copy(hashChainValid = !privacyRecord.hashChainValid)
                },
                onResetHash = {
                    privacyRecord = privacyRecord.copy(hashChainValid = true)
                }
            )
        }
    }
}

@Composable
fun MainScaffold(
    windowSizeClass: WindowSizeClass,
    privacyRecord: PrivacyRecord,
    userPrefs: com.onshift.app.data.model.UserPreferences,
    onLanguageToggle: () -> Unit,
    onTamperDemo: () -> Unit,
    onResetHash: () -> Unit
) {
    val navController = rememberNavController()
    val items = listOf(
        Screen.Home,
        Screen.Evidence,
        Screen.CredentialTab,
        Screen.Schemes,
        Screen.Profile
    )

    Scaffold(
        bottomBar = {
            val navBackStackEntry by navController.currentBackStackEntryAsState()
            val currentDestination = navBackStackEntry?.destination
            FloatingBottomBar(
                items = items,
                currentDestination = currentDestination,
                onNavigate = { screen ->
                    navController.navigate(screen.route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            )
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Home.route) {
                HomeScreen(
                    windowSizeClass = windowSizeClass,
                    worker = MockData.reconciledStateWorker,
                    reconciliationResult = MockData.scenarioMatched,
                    userPrefs = userPrefs
                )
            }
            composable(Screen.Evidence.route) {
                EvidenceScreen(
                    evidenceList = MockData.mixedEvidence,
                    selectedPlatforms = userPrefs.selectedPlatforms
                )
            }
            composable(Screen.CredentialTab.route) {
                CredentialNavGraph()
            }
            composable(Screen.Schemes.route) {
                GovernmentSchemesScreen(schemeMatches = MockData.mockSchemeMatches)
            }
            composable(Screen.Profile.route) {
                ProfileScreen(
                    privacyRecord = privacyRecord,
                    onLanguageToggle = onLanguageToggle,
                    onEditPlatforms = { /* Edit platforms logic */ },
                    onTamperDemo = onTamperDemo,
                    onResetHash = onResetHash
                )
            }
        }
    }
}

@Composable
fun FloatingBottomBar(
    items: List<Screen>,
    currentDestination: NavDestination?,
    onNavigate: (Screen) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(110.dp) // Increased height to prevent clipping
            .zIndex(1f), // Ensure it stays on top of screen content
        contentAlignment = Alignment.BottomCenter
    ) {
        // The background of the nav bar
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .height(72.dp),
            color = Background,
            tonalElevation = 8.dp,
            shadowElevation = 8.dp // Added shadow for better separation
        ) {}

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(110.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.Bottom
        ) {
            items.forEach { screen ->
                val selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true
                FloatingBottomNavItem(
                    screen = screen,
                    selected = selected,
                    onClick = { onNavigate(screen) }
                )
            }
        }
    }
}

@Composable
fun FloatingBottomNavItem(
    screen: Screen,
    selected: Boolean,
    onClick: () -> Unit
) {
    val verticalOffset by animateDpAsState(
        targetValue = if (selected) (-32).dp else 0.dp,
        animationSpec = androidx.compose.animation.core.spring(
            dampingRatio = androidx.compose.animation.core.Spring.DampingRatioMediumBouncy,
            stiffness = androidx.compose.animation.core.Spring.StiffnessLow
        ),
        label = "verticalOffset"
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(72.dp)
            .padding(bottom = 12.dp)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick
            )
            .offset(y = verticalOffset)
    ) {
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(if (selected) Primary else Color.Transparent),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = screen.icon,
                contentDescription = null,
                tint = if (selected) Color.Black else OnSurface.copy(alpha = 0.4f),
                modifier = Modifier.size(26.dp)
            )
        }
        
        AnimatedVisibility(
            visible = selected,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically()
        ) {
            Text(
                text = stringResource(screen.resourceId),
                style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                color = OnSurface,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 4.dp),
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Visible,
                softWrap = false
            )
        }
    }
}

@Composable
fun CredentialNavGraph() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "selective_disclosure") {
        composable("selective_disclosure") {
            SelectiveDisclosureScreen(onGenerate = {
                navController.navigate("credential_view")
            })
        }
        composable("credential_view") {
            CredentialScreen(credential = MockData.mockCredential)
        }
    }
}
