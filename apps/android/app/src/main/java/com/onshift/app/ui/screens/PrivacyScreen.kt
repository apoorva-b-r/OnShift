package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onshift.app.data.model.PrivacyRecord
import com.onshift.app.ui.components.OnShiftCard
import com.onshift.app.ui.components.OnShiftScaffold
import com.onshift.app.ui.theme.Primary
import com.onshift.app.ui.theme.StatusReconciled
import com.onshift.app.ui.theme.StatusUnreconciled
import com.onshift.app.ui.theme.TextSecondary

@Composable
fun PrivacyScreen(
    privacyRecord: PrivacyRecord,
    onNext: () -> Unit,
    onBack: () -> Unit
) {
    OnShiftScaffold(
        title = "Privacy",
        step = 6,
        onBackClick = onBack,
        bottomBar = {
            Button(
                onClick = onNext,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) {
                Text("Next")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Privacy and Security",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            
            OnShiftCard {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Lock, contentDescription = null, tint = Primary, modifier = Modifier.size(24.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(text = "Data Security", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(text = "Hash Chain Integrity", style = MaterialTheme.typography.bodyLarge, color = TextSecondary)
                    Text(
                        text = if (privacyRecord.hashChainValid) "INTEGRITY VALID" else "INTEGRITY FAILED",
                        color = if (privacyRecord.hashChainValid) StatusReconciled else StatusUnreconciled,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(text = "Last Verified", style = MaterialTheme.typography.bodyLarge, color = TextSecondary)
                    Text(text = privacyRecord.lastVerifiedAt, style = MaterialTheme.typography.bodyMedium)
                }
            }
            
            Text(
                text = "Your data is end-to-end encrypted. OnShift never sees your raw financial data.",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}
