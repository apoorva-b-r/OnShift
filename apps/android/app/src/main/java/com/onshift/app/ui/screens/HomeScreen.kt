package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun HomeScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = "OnShift Dashboard", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(12.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Verified Income: ₹30,100", style = MaterialTheme.typography.headlineSmall)
                Text(text = "Period: 01 Aug to 07 Aug 2026", style = MaterialTheme.typography.bodyMedium)
                Text(text = "Verification Level: FINANCIALLY CORROBORATED", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
