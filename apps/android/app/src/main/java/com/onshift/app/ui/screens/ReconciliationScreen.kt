package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onshift.app.data.model.ReconciliationResult
import com.onshift.app.ui.components.OnShiftCard
import com.onshift.app.ui.components.OnShiftScaffold
import com.onshift.app.ui.components.ReconciliationStatusBadge
import com.onshift.app.ui.theme.Primary
import com.onshift.app.ui.theme.StatusUnreconciled
import com.onshift.app.ui.theme.TextSecondary

@Composable
fun ReconciliationScreen(
    reconciliationResult: ReconciliationResult,
    onNext: () -> Unit,
    onBack: () -> Unit
) {
    OnShiftScaffold(
        title = "Reconciliation",
        step = 4,
        onBackClick = onBack,
        bottomBar = {
            Button(
                onClick = onNext,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) {
                Text("Next")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Income Reconciliation",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            
            OnShiftCard {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Period: ${reconciliationResult.period}", style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(text = "Expected", style = MaterialTheme.typography.titleMedium, color = TextSecondary)
                            Text(text = "₹${String.format("%,.0f", reconciliationResult.expected)}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(text = "Actual", style = MaterialTheme.typography.titleMedium, color = TextSecondary)
                            Text(text = "₹${String.format("%,.0f", reconciliationResult.actual)}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    ReconciliationStatusBadge(status = reconciliationResult.status)
                    
                    if (reconciliationResult.differenceAmount > 0) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Surface(
                            color = StatusUnreconciled.copy(alpha = 0.1f),
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Info, contentDescription = null, tint = StatusUnreconciled, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Difference: ₹${String.format("%,.0f", reconciliationResult.differenceAmount)}",
                                    color = StatusUnreconciled,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
