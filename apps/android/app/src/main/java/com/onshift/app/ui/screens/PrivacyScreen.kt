package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun PrivacyScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = "Privacy Layer Control", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(12.dp))
        Text(text = "1. Pseudonymous Worker ID: OS-DEMO-001")
        Text(text = "2. Encrypted Local Storage: Active (Android Keystore)")
        Text(text = "3. Provenance: Local SHA-256 Tamper Detection")
        Text(text = "4. Data Sharing: Worker Consent Required")
    }
}
