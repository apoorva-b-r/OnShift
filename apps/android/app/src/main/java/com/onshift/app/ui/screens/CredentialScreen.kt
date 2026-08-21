package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun CredentialScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = "Signed Portable Credential", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(12.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Type: OnShiftIncomeCredential", style = MaterialTheme.typography.titleMedium)
                Text(text = "Issuer: OnShift Proof Authority")
                Text(text = "Signature: Ed25519 Verified")
                Text(text = "Worker Pseudonym: OS-DEMO-001")
            }
        }
    }
}
