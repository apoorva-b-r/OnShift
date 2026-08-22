package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.onshift.app.R

@Composable
fun VerificationScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = stringResource(R.string.evidence_verification_title), style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(12.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = stringResource(R.string.level_financially_corroborated_val), style = MaterialTheme.typography.titleMedium)
                Text(text = stringResource(R.string.confidence_score, "0.96"))
                Text(text = stringResource(R.string.verification_reason))
            }
        }
    }
}
