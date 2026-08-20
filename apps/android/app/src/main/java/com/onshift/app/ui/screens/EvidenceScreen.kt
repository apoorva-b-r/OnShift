package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun EvidenceScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = "Evidence Vault", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(12.dp))
        Text(text = "1. DECLARED: Self-Reported Payout (₹30,500)")
        Text(text = "2. OBSERVED: Zomato Payout Notification (₹18,200)")
        Text(text = "3. OBSERVED: Swiggy Payout Notification (₹12,300)")
        Text(text = "4. FINANCIAL: HDFC Bank Account Aggregator Credit (₹30,100)")
        Spacer(modifier = Modifier.height(16.dp))
        Text(text = "Local Tamper Detection: HASH CHAIN VALID", style = MaterialTheme.typography.labelLarge)
    }
}
