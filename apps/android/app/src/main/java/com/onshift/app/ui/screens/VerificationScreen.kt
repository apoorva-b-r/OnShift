package com.onshift.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.model.MockData
import com.onshift.app.data.model.VerificationLevel
import com.onshift.app.data.model.VerificationResult
import com.onshift.app.ui.common.*
import com.onshift.app.ui.theme.*

@Composable
fun VerificationScreen(
    uiState: UiState<VerificationResult>? = null
) {
    if (uiState != null) {
        when (uiState) {
            is UiState.Loading -> UiStateLoadingView()
            is UiState.Error -> UiStateErrorView(message = uiState.message)
            is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.empty_data))
            is UiState.Success -> VerificationContent(initialResult = uiState.data)
        }
    } else {
        VerificationContent(initialResult = MockData.mockVerificationResult)
    }
}

@Composable
fun VerificationContent(
    initialResult: VerificationResult
) {
    var selectedLevelIndex by remember { mutableStateOf(3) } // Default to FINANCIALLY_CORROBORATED

    val levelData = remember(selectedLevelIndex) {
        when (selectedLevelIndex) {
            0 -> Triple(VerificationLevel.DECLARED, 0.40, R.string.level_declared_desc)
            1 -> Triple(VerificationLevel.OBSERVED, 0.70, R.string.level_observed_desc)
            2 -> Triple(VerificationLevel.CORROBORATED, 0.88, R.string.level_corroborated_desc)
            else -> Triple(VerificationLevel.FINANCIALLY_CORROBORATED, 0.96, R.string.level_financially_corroborated_desc)
        }
    }

    val (currentLevel, currentScore, explanationRes) = levelData
    val confidencePct = (currentScore * 100).toInt()

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Page Title
        Text(
            text = stringResource(R.string.evidence_verification_title),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = OnSurface
        )

        // Interactive Level Switcher Controls
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = stringResource(R.string.select_verification_level),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = OnSurface
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val levels = listOf("DECLARED", "OBSERVED", "CORROBORATED", "FINANCIAL")
                    levels.forEachIndexed { index, name ->
                        Button(
                            onClick = { selectedLevelIndex = index },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (selectedLevelIndex == index) Primary else Color.LightGray.copy(alpha = 0.3f),
                                contentColor = if (selectedLevelIndex == index) OnSurface else TextSecondary
                            ),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(horizontal = 4.dp, vertical = 8.dp)
                        ) {
                            Text(
                                text = name,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
        }

        // Detailed Verification Card
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header Level Badge & Confidence Score Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        color = Primary.copy(alpha = 0.2f),
                        shape = RoundedCornerShape(50)
                    ) {
                        Text(
                            text = currentLevel.name.replace("_", " "),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = OnSurface,
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                        )
                    }

                    Surface(
                        color = StatusReconciled.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(50)
                    ) {
                        Text(
                            text = stringResource(R.string.confidence_percentage, confidencePct),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = StatusReconciled,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                }

                // 4-Step Progress Bar
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        for (i in 0..3) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(10.dp)
                                    .background(
                                        color = if (i <= selectedLevelIndex) StatusReconciled else Color.LightGray.copy(alpha = 0.3f),
                                        shape = RoundedCornerShape(4.dp)
                                    )
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(text = "Declared", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                        Text(text = "Observed", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                        Text(text = "Corroborated", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                        Text(text = "Financial", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                    }
                }

                Divider()

                // Explanation Text Card
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        text = "Verification Explanation",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = OnSurface
                    )
                    Text(
                        text = stringResource(explanationRes),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                }
            }
        }
    }
}

// Previews for all 4 states
@Preview(showBackground = true, name = "VerificationScreen Loading")
@Composable
fun VerificationScreenPreviewLoading() {
    VerificationScreen(uiState = UiState.Loading)
}

@Preview(showBackground = true, name = "VerificationScreen Error")
@Composable
fun VerificationScreenPreviewError() {
    VerificationScreen(uiState = UiState.Error("Could not reach the server, showing saved data instead"))
}

@Preview(showBackground = true, name = "VerificationScreen Empty")
@Composable
fun VerificationScreenPreviewEmpty() {
    VerificationScreen(uiState = UiState.Empty)
}

@Preview(showBackground = true, name = "VerificationScreen Populated")
@Composable
fun VerificationScreenPreviewPopulated() {
    VerificationScreen(uiState = UiState.Success(MockData.mockVerificationResult))
}
