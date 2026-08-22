package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun SelectiveDisclosureScreen(
    onClaimsSelected: (List<String>) -> Unit = {}
) {
    var includeVerifiedIncome by remember { mutableStateOf(true) }
    var includePeriod by remember { mutableStateOf(true) }
    var includeVerificationLevel by remember { mutableStateOf(true) }
    var includePlatformBreakdown by remember { mutableStateOf(false) }
    var includeRawBankTransactions by remember { mutableStateOf(false) }

    val previewClaims by remember(
        includeVerifiedIncome,
        includePeriod,
        includeVerificationLevel,
        includePlatformBreakdown,
        includeRawBankTransactions
    ) {
        derivedStateOf {
            buildList {
                if (includeVerifiedIncome) add("Verified Income: ₹30,100")
                if (includePeriod) add("Period: July 2026")
                if (includeVerificationLevel) add("Verification Level: FINANCIALLY CORROBORATED")
                if (includePlatformBreakdown) add("Platform Detailed Breakdown")
                if (includeRawBankTransactions) add("Raw Bank Statement Transactions")
            }
        }
    }

    LaunchedEffect(previewClaims) {
        onClaimsSelected(previewClaims)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            text = "Selective Disclosure Claims",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Select which claims to include in your generated credential preview:",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))

        DisclosureCheckboxRow(
            label = "Verified Income (₹30,100)",
            checked = includeVerifiedIncome,
            onCheckedChange = { includeVerifiedIncome = it }
        )
        DisclosureCheckboxRow(
            label = "Period (July 2026)",
            checked = includePeriod,
            onCheckedChange = { includePeriod = it }
        )
        DisclosureCheckboxRow(
            label = "Verification Level (FINANCIALLY CORROBORATED)",
            checked = includeVerificationLevel,
            onCheckedChange = { includeVerificationLevel = it }
        )
        DisclosureCheckboxRow(
            label = "Platform Detailed Breakdown",
            checked = includePlatformBreakdown,
            onCheckedChange = { includePlatformBreakdown = it }
        )
        DisclosureCheckboxRow(
            label = "Raw Bank Statement Transactions",
            checked = includeRawBankTransactions,
            onCheckedChange = { includeRawBankTransactions = it }
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Credential Output Preview",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Type: OnShiftIncomeCredential",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Disclosed Claims (${previewClaims.size}):",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Spacer(modifier = Modifier.height(4.dp))
                if (previewClaims.isEmpty()) {
                    Text(
                        text = "• No claims selected for disclosure",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                } else {
                    previewClaims.forEach { claim ->
                        Text(
                            text = "• $claim",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DisclosureCheckboxRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge
        )
    }
}

