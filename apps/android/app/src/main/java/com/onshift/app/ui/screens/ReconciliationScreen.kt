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
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.model.MockData
import com.onshift.app.data.model.ReconciliationResult
import com.onshift.app.data.model.ReconciliationStatus
import com.onshift.app.ui.common.*
import com.onshift.app.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

@Composable
fun ReconciliationScreen(
    uiState: UiState<ReconciliationResult>? = null
) {
    if (uiState != null) {
        when (uiState) {
            is UiState.Loading -> UiStateLoadingView()
            is UiState.Error -> UiStateErrorView(message = uiState.message)
            is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.awaiting_reconciliation))
            is UiState.Success -> ReconciliationContent(initialResult = uiState.data)
        }
    } else {
        ReconciliationContent(initialResult = MockData.scenarioMatched)
    }
}

@Composable
fun ReconciliationContent(
    initialResult: ReconciliationResult
) {
    var activeScenario by remember { mutableStateOf(if (initialResult.status == ReconciliationStatus.MATCHED) 1 else 2) }

    val currentResult = remember(activeScenario) {
        if (activeScenario == 1) MockData.scenarioMatched else MockData.scenarioUnexplainedDifference
    }

    val currencyFormatter = remember {
        NumberFormat.getCurrencyInstance(Locale("en", "IN")).apply {
            maximumFractionDigits = 0
        }
    }

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
            text = stringResource(R.string.reconciliation_engine),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = OnSurface
        )

        // Interactive Scenario Switcher
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
                    text = stringResource(R.string.select_scenario),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = OnSurface
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { activeScenario = 1 },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (activeScenario == 1) Primary else Color.LightGray.copy(alpha = 0.3f),
                            contentColor = if (activeScenario == 1) OnSurface else TextSecondary
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(vertical = 10.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.scenario_1_matched),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Button(
                        onClick = { activeScenario = 2 },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (activeScenario == 2) StatusUnreconciled else Color.LightGray.copy(alpha = 0.3f),
                            contentColor = if (activeScenario == 2) Color.White else TextSecondary
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(vertical = 10.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.scenario_2_shortfall),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Main Reconciliation Card
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Status Header Badge Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Period: ${currentResult.period}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = OnSurface
                    )

                    val isMatched = currentResult.status == ReconciliationStatus.MATCHED
                    Surface(
                        color = if (isMatched) StatusReconciled.copy(alpha = 0.15f) else StatusUnreconciled.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(50)
                    ) {
                        Text(
                            text = if (isMatched) "MATCHED ✓" else "UNEXPLAINED DIFFERENCE ✗",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (isMatched) StatusReconciled else StatusUnreconciled,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                }

                Divider()

                // Detailed Line Items
                ReconciliationLineItem(
                    label = stringResource(R.string.expected_amount_val),
                    valueColor = OnSurface
                )

                ReconciliationLineItem(
                    label = stringResource(R.string.known_deductions_val),
                    valueColor = TextSecondary
                )

                ReconciliationLineItem(
                    label = stringResource(R.string.expected_settlement_val),
                    valueColor = Primary,
                    isBold = true
                )

                ReconciliationLineItem(
                    label = stringResource(R.string.actual_settlement_fmt, currencyFormatter.format(currentResult.actual)),
                    valueColor = if (currentResult.status == ReconciliationStatus.MATCHED) StatusReconciled else StatusUnreconciled,
                    isBold = true
                )

                Divider()

                // Shortfall / Difference Highlight
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.difference_fmt, currencyFormatter.format(currentResult.differenceAmount)),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (currentResult.differenceAmount > 0) StatusUnreconciled else StatusReconciled
                    )

                    if (currentResult.differenceAmount > 0) {
                        Surface(
                            color = StatusUnreconciled,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(
                                text = "-${currencyFormatter.format(currentResult.differenceAmount)} Shortfall",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ReconciliationLineItem(
    label: String,
    valueColor: Color,
    isBold: Boolean = false
) {
    Text(
        text = label,
        style = if (isBold) MaterialTheme.typography.bodyLarge else MaterialTheme.typography.bodyMedium,
        fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal,
        color = valueColor
    )
}

// Previews for all 4 states
@Preview(showBackground = true, name = "ReconciliationScreen Loading")
@Composable
fun ReconciliationScreenPreviewLoading() {
    ReconciliationScreen(uiState = UiState.Loading)
}

@Preview(showBackground = true, name = "ReconciliationScreen Error")
@Composable
fun ReconciliationScreenPreviewError() {
    ReconciliationScreen(uiState = UiState.Error("Could not reach the server, showing saved data instead"))
}

@Preview(showBackground = true, name = "ReconciliationScreen Empty")
@Composable
fun ReconciliationScreenPreviewEmpty() {
    ReconciliationScreen(uiState = UiState.Empty)
}

@Preview(showBackground = true, name = "ReconciliationScreen Populated")
@Composable
fun ReconciliationScreenPreviewPopulated() {
    ReconciliationScreen(uiState = UiState.Success(MockData.scenarioMatched))
}
