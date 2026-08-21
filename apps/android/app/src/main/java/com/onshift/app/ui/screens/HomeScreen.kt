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
import androidx.compose.material3.*
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.model.*
import com.onshift.app.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

@Composable
fun HomeScreen(
    windowSizeClass: WindowSizeClass,
    worker: Worker,
    reconciliationResult: ReconciliationResult?,
    userPrefs: UserPreferences
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
                    // Fill empty slots in the last row to maintain alignment
                    repeat(columns - rowStats.size) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        // Reconciliation Card
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(text = stringResource(R.string.reconciliation_status), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            ReconciliationCard(reconciliationResult, currencyFormatter)
        }

        // Verification Level Bar
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(text = stringResource(R.string.verification_level), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            VerificationLevelBar(worker.verificationLevel)
        }
    }
}

@Composable
fun StatusIndicator(text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF4CAF50), modifier = Modifier.size(16.dp))
        Text(text = text, style = MaterialTheme.typography.labelMedium, color = TextSecondary)
    }
}

@Composable
fun ReconciliationCard(result: ReconciliationResult?, formatter: NumberFormat) {
    val containerColor = if (result != null) Color(0xFF7BBBFF) else MaterialTheme.colorScheme.surfaceVariant
    val contentColor = if (result != null) Color.Black else MaterialTheme.colorScheme.onSurfaceVariant

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
                        color = Color(0xFFB00020)
                    )
                }
            }
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
