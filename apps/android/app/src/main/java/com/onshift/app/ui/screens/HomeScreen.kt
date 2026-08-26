package com.onshift.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material3.*
import androidx.compose.material3.windowsizeclass.ExperimentalMaterial3WindowSizeClassApi
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.model.*
import com.onshift.app.ui.common.*
import com.onshift.app.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

data class HomeData(
    val worker: Worker,
    val reconciliationResult: ReconciliationResult?,
    val userPrefs: UserPreferences,
    val verificationResult: VerificationResult?
)

@Composable
fun HomeScreen(
    windowSizeClass: WindowSizeClass,
    worker: Worker,
    reconciliationResult: ReconciliationResult?,
    userPrefs: UserPreferences,
    onOpenAccountAggregator: () -> Unit = {},
    verificationResult: VerificationResult? = MockData.mockVerificationResult,
    uiState: UiState<HomeData> = UiState.Success(HomeData(worker, reconciliationResult, userPrefs, verificationResult))
) {
    when (uiState) {
        is UiState.Loading -> UiStateLoadingView()
        is UiState.Error -> UiStateErrorView(message = uiState.message)
        is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.awaiting_reconciliation))
        is UiState.Success -> {
            val data = uiState.data
            HomeScreenContent(
                windowSizeClass = windowSizeClass,
                worker = data.worker,
                reconciliationResult = data.reconciliationResult,
                userPrefs = data.userPrefs,
                verificationResult = data.verificationResult,
                onOpenAccountAggregator = onOpenAccountAggregator
            )
        }
    }
}

@Composable
fun HomeScreenContent(
    windowSizeClass: WindowSizeClass,
    worker: Worker,
    reconciliationResult: ReconciliationResult?,
    userPrefs: UserPreferences,
    verificationResult: VerificationResult?,
    onOpenAccountAggregator: () -> Unit = {}
) {
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "IN")).apply {
        maximumFractionDigits = 0
    }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = stringResource(R.string.welcome_worker, worker.id),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = OnSurface
            )
            
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                StatusIndicator(text = stringResource(R.string.identity_verified))
                StatusIndicator(text = stringResource(R.string.platforms_connected))
            }
        }

        // Platform Stats
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(text = stringResource(R.string.platform_activity), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            
            val selectedPlatforms = userPrefs.selectedPlatforms
            val platformStats = selectedPlatforms.map { platform ->
                val count = MockData.mixedEvidence.count { it.source == platform }
                platform to count.toString()
            }

            val columns = when (windowSizeClass.widthSizeClass) {
                WindowWidthSizeClass.Compact -> 2
                else -> 3
            }

            platformStats.chunked(columns).forEach { rowStats ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    rowStats.forEach { (name, count) ->
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = name,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = TextSecondary
                                )
                                Text(
                                    text = count,
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                    repeat(columns - rowStats.size) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        // Reconciliation Card
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onOpenAccountAggregator, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.AccountBalance, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Verify Income")
            }
            Text(text = stringResource(R.string.reconciliation_status), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            ReconciliationCard(reconciliationResult, currencyFormatter)
        }

        // Verification Level Card
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(text = stringResource(R.string.verification_level), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            VerificationLevelCard(
                level = worker.verificationLevel,
                verificationResult = verificationResult
            )
        }
    }
}

@Composable
fun StatusIndicator(text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = StatusReconciled, modifier = Modifier.size(16.dp))
        Text(text = text, style = MaterialTheme.typography.labelMedium, color = TextSecondary)
    }
}

@Composable
fun ReconciliationCard(result: ReconciliationResult?, formatter: NumberFormat) {
    val containerColor = if (result != null) Primary else MaterialTheme.colorScheme.surfaceVariant
    val contentColor = if (result != null) OnSurface else MaterialTheme.colorScheme.onSurfaceVariant

    Card(
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = containerColor,
            contentColor = contentColor
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            if (result == null) {
                Text(
                    text = stringResource(R.string.awaiting_reconciliation),
                    style = MaterialTheme.typography.bodyLarge,
                    color = contentColor.copy(alpha = 0.6f)
                )
                Text(
                    text = formatter.format(0),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = if (result.status == ReconciliationStatus.MATCHED)
                            stringResource(R.string.matched)
                        else
                            stringResource(R.string.unexplained_difference),
                        color = if (result.status == ReconciliationStatus.MATCHED) OnSurface else StatusUnreconciled,
                        fontWeight = FontWeight.Bold
                    )
                    Text(text = result.period, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = stringResource(R.string.expected_income, formatter.format(result.expected)))
                Text(text = stringResource(R.string.actual_income, formatter.format(result.actual)))
                if (result.status == ReconciliationStatus.UNEXPLAINED_DIFFERENCE) {
                    Text(
                        text = stringResource(R.string.difference_amount, formatter.format(result.differenceAmount)),
                        color = StatusUnreconciled
                    )
                }
            }
        }
    }
}

@Composable
fun VerificationLevelCard(
    level: VerificationLevel,
    verificationResult: VerificationResult?
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val levelRes = when (level) {
                    VerificationLevel.DECLARED -> R.string.level_declared
                    VerificationLevel.OBSERVED -> R.string.level_observed
                    VerificationLevel.CORROBORATED -> R.string.level_corroborated
                    VerificationLevel.FINANCIALLY_CORROBORATED -> R.string.level_financially_corroborated
                }
                Text(
                    text = stringResource(levelRes),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = OnSurface
                )

                val confidencePct = ((verificationResult?.confidenceScore ?: 0.96) * 100).toInt()
                Surface(
                    color = StatusReconciled.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(50)
                ) {
                    Text(
                        text = stringResource(R.string.confidence_percentage, confidencePct),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = StatusReconciled,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = stringResource(R.string.verification_explanation),
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary
            )

            Spacer(modifier = Modifier.height(16.dp))

            VerificationLevelBar(level)
        }
    }
}

@Composable
fun VerificationLevelBar(level: VerificationLevel) {
    val levels = VerificationLevel.entries
    val currentIndex = levels.indexOf(level)
    
    val colors = listOf(LevelDeclared, LevelObserved, LevelCorroborated, LevelFinCorroborated)
    
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(12.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(6.dp)),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        levels.forEachIndexed { index, _ ->
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .background(
                        if (index <= currentIndex) colors[index] else Color.Transparent,
                        RoundedCornerShape(6.dp)
                    )
            )
        }
    }
    
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = stringResource(R.string.level_declared), style = MaterialTheme.typography.labelSmall)
        Text(text = stringResource(R.string.level_financially_corroborated), style = MaterialTheme.typography.labelSmall)
    }
}

// Previews for all 4 states
@OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
@Preview(showBackground = true, name = "HomeScreen Loading")
@Composable
fun HomeScreenPreviewLoading() {
    val dummyWindowSize = WindowSizeClass.calculateFromSize(DpSize(400.dp, 800.dp))
    HomeScreen(
        windowSizeClass = dummyWindowSize,
        worker = MockData.reconciledStateWorker,
        reconciliationResult = MockData.scenarioMatched,
        userPrefs = UserPreferences(),
        uiState = UiState.Loading
    )
}

@OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
@Preview(showBackground = true, name = "HomeScreen Error")
@Composable
fun HomeScreenPreviewError() {
    val dummyWindowSize = WindowSizeClass.calculateFromSize(DpSize(400.dp, 800.dp))
    HomeScreen(
        windowSizeClass = dummyWindowSize,
        worker = MockData.reconciledStateWorker,
        reconciliationResult = MockData.scenarioMatched,
        userPrefs = UserPreferences(),
        uiState = UiState.Error("Could not reach the server, showing saved data instead")
    )
}

@OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
@Preview(showBackground = true, name = "HomeScreen Empty")
@Composable
fun HomeScreenPreviewEmpty() {
    val dummyWindowSize = WindowSizeClass.calculateFromSize(DpSize(400.dp, 800.dp))
    HomeScreen(
        windowSizeClass = dummyWindowSize,
        worker = MockData.zeroStateWorker,
        reconciliationResult = null,
        userPrefs = UserPreferences(),
        uiState = UiState.Empty
    )
}

@OptIn(ExperimentalMaterial3WindowSizeClassApi::class)
@Preview(showBackground = true, name = "HomeScreen Populated")
@Composable
fun HomeScreenPreviewPopulated() {
    val dummyWindowSize = WindowSizeClass.calculateFromSize(DpSize(400.dp, 800.dp))
    HomeScreen(
        windowSizeClass = dummyWindowSize,
        worker = MockData.reconciledStateWorker,
        reconciliationResult = MockData.scenarioMatched,
        userPrefs = UserPreferences(selectedPlatforms = listOf("Zomato", "Swiggy")),
        uiState = UiState.Success(
            HomeData(
                worker = MockData.reconciledStateWorker,
                reconciliationResult = MockData.scenarioMatched,
                userPrefs = UserPreferences(selectedPlatforms = listOf("Zomato", "Swiggy")),
                verificationResult = MockData.mockVerificationResult
            )
        )
    )
}
