package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onshift.app.data.model.Credential
import com.onshift.app.data.model.MockData

@Composable
fun CredentialScreen(
    credential: Credential = MockData.mockCredential,
    disclosedClaims: List<String>? = null
) {
    val claimsToDisplay = disclosedClaims ?: credential.includedClaims

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Text(
            text = "Signed Portable Credential",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(12.dp))
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Type: OnShiftIncomeCredential",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = "Issuer: OnShift Proof Authority")
                Text(text = "Signature: Ed25519 Verified (${credential.signaturePreview ?: "0x7d...a1b"})")
                Text(text = "Worker Pseudonym: ${credential.workerId}")
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Disclosed Claims (${claimsToDisplay.size}):",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(4.dp))
                if (claimsToDisplay.isEmpty()) {
                    Text(
                        text = "• No claims selected",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                } else {
                    claimsToDisplay.forEach { claim ->
                        Text(
                            text = "• $claim",
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }
            }
        }
    }
}

