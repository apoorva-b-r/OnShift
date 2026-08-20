package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun ReconciliationScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = "Reconciliation Engine", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(12.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Expected Amount: ₹30,500")
                Text(text = "Known Deductions: ₹400 (Uniform Charge)")
                Text(text = "Expected Settlement: ₹30,100")
                Text(text = "Actual Bank Settlement: ₹30,100")
                Text(text = "Difference: ₹0")
                Text(text = "Status: MATCHED", style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}
