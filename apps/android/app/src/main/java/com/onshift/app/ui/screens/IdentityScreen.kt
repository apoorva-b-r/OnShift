package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun IdentityScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = "Worker Identity",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Pseudonymous OnShift ID: OS-DEMO-001",
            style = MaterialTheme.typography.bodyLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Card(
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Worker Name: Ravi Kumar", style = MaterialTheme.typography.titleMedium)
                Text(text = "Primary Role: Delivery Partner (Zomato, Swiggy)", style = MaterialTheme.typography.bodyMedium)
                Text(text = "Status: Encrypted Vault Active", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
