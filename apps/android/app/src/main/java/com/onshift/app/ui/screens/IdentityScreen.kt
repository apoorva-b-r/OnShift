package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.onshift.app.R

@Composable
fun IdentityScreen(
    isOnboarding: Boolean = false,
    onCompleteOnboarding: () -> Unit = {}
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        Text(
            text = stringResource(R.string.identity_verification),
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.pseudonym_id, "OS-DEMO-001"),
            style = MaterialTheme.typography.bodyLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Card(
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = stringResource(R.string.worker_name, "Ravi Kumar"), style = MaterialTheme.typography.titleMedium)
                Text(text = stringResource(R.string.primary_role), style = MaterialTheme.typography.bodyMedium)
                Text(text = stringResource(R.string.vault_status_active), style = MaterialTheme.typography.bodySmall)
            }
        }
        if (isOnboarding) {
            Spacer(modifier = Modifier.weight(1f))
            Button(
                onClick = onCompleteOnboarding,
                modifier = Modifier.fillMaxWidth(),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
            ) {
                Text(text = stringResource(R.string.continue_btn))
            }
        }
    }
}
