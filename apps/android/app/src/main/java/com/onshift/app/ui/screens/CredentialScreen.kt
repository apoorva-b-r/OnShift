package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.model.Credential
import java.text.NumberFormat
import java.util.Locale

@Composable
fun CredentialScreen(
    credential: Credential
) {
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "IN")).apply {
        maximumFractionDigits = 0
    }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp)
    ) {
        Text(
            text = stringResource(R.string.income_credential),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(24.dp))

        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = com.onshift.app.ui.theme.OnSurface,
                contentColor = Color.White
            )
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                Text(
                    text = "ONSHIFT INCOME CREDENTIAL",
                    style = MaterialTheme.typography.labelMedium,
                    color = com.onshift.app.ui.theme.Primary,
                    fontWeight = FontWeight.Bold
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp), color = Color.Gray.copy(alpha = 0.3f))
                
                DetailRow(label = stringResource(R.string.claim_worker_id), value = credential.workerId)
                DetailRow(label = stringResource(R.string.claim_period), value = credential.period)
                credential.verifiedIncome?.let {
                    DetailRow(label = stringResource(R.string.claim_verified_income), value = currencyFormatter.format(it))
                }
                credential.verificationLevel?.let {
                    DetailRow(label = stringResource(R.string.claim_verification_level), value = it.name)
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                credential.signaturePreview?.let {
                    Text(
                        text = stringResource(R.string.signature, it),
                        style = MaterialTheme.typography.labelSmall,
                        fontFamily = FontFamily.Monospace,
                        color = Color.LightGray.copy(alpha = 0.7f)
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Button(
            onClick = { /* Share logic */ },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.share_with_lender))
        }
    }
}

@Composable
fun DetailRow(label: String, value: String) {
    Column(modifier = Modifier.padding(vertical = 4.dp)) {
        Text(text = label, style = MaterialTheme.typography.labelLarge, color = Color.LightGray.copy(alpha = 0.7f))
        Text(text = value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
    }
}
