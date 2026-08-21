package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun SelectiveDisclosureScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = "Selective Disclosure Claims", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(12.dp))
        Text(text = "[X] Verified Income (₹30,100)")
        Text(text = "[X] Verification Level (FINANCIALLY CORROBORATED)")
        Text(text = "[ ] Platform Detailed Breakdown (Unchecked)")
        Text(text = "[ ] Raw Bank Statement Transactions (Unchecked)")
    }
}
