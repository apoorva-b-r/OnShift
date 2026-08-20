package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun VerificationScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = "Evidence Verification Level", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(12.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Level: FINANCIALLY CORROBORATED", style = MaterialTheme.typography.titleMedium)
                Text(text = "Confidence Score: 0.96")
                Text(text = "Reason: Platform notifications match bank settlement credit via Account Aggregator flow.")
            }
        }
    }
}
