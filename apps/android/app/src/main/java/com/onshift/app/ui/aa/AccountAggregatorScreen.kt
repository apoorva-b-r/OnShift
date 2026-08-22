package com.onshift.app.ui.aa

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.onshift.app.data.aa.AATransaction

@Composable
fun AccountAggregatorScreen(
    onBack: () -> Unit,
    accountAggregatorViewModel: AccountAggregatorViewModel = viewModel()
) {
    val state by accountAggregatorViewModel.uiState.collectAsState()
    LaunchedEffect(Unit) {
        if (state is AAUiState.Idle) accountAggregatorViewModel.startConsentFlow("OS-DEMO-001", listOf("DEPOSIT", "TRANSACTIONS"))
    }
    Column(modifier = Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Financial verification", style = MaterialTheme.typography.headlineSmall)
            Button(onClick = onBack) { Text("Back") }
        }
        when (val current = state) {
            AAUiState.Idle, AAUiState.RequestingConsent, AAUiState.FetchingData ->
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                    CircularProgressIndicator()
                    Text(if (state is AAUiState.RequestingConsent) "Requesting consent" else "Loading financial data")
                }
            is AAUiState.AwaitingApproval -> {
                Text("Waiting for approval. Tap here once approved.")
                Text(current.redirectUrl)
                Button(onClick = { accountAggregatorViewModel.retry() }) { Text("Check again") }
            }
            is AAUiState.Error -> {
                Card(modifier = Modifier.fillMaxWidth()) { Text(current.message, modifier = Modifier.padding(16.dp)) }
                Button(onClick = { accountAggregatorViewModel.retry() }) { Text("Retry") }
            }
            is AAUiState.Success -> {
                if (current.isMock) {
                    Card(modifier = Modifier.fillMaxWidth(), colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                        Text("Sample data — sandbox unavailable.", modifier = Modifier.padding(16.dp), color = MaterialTheme.colorScheme.onErrorContainer)
                    }
                }
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(current.transactions) { transaction -> TransactionRow(transaction) }
                }
            }
        }
    }
}

@Composable
private fun TransactionRow(transaction: AATransaction) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(transaction.narration, style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(4.dp))
            Text("INR ${transaction.amount} | ${transaction.date}")
            Text(transaction.bankName)
        }
    }
}
