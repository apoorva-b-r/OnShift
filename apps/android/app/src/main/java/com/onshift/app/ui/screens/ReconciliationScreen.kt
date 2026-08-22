package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.onshift.app.R

@Composable
fun ReconciliationScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = stringResource(R.string.reconciliation_engine), style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(12.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = stringResource(R.string.expected_amount_val))
                Text(text = stringResource(R.string.known_deductions_val))
                Text(text = stringResource(R.string.expected_settlement_val))
                Text(text = stringResource(R.string.actual_settlement_val))
                Text(text = stringResource(R.string.difference_val))
                Text(text = stringResource(R.string.status_matched_label), style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}
