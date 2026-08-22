package com.onshift.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.model.PrivacyRecord

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(
    privacyRecord: PrivacyRecord,
    selectedPlatforms: List<String>,
    onLanguageToggle: () -> Unit,
    onEditPlatforms: () -> Unit,
    onTamperDemo: () -> Unit,
    onResetHash: () -> Unit,
    onRestartDemo: () -> Unit
) {
    val scrollState = rememberScrollState()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Avatar
        Box(
            modifier = Modifier
                .size(100.dp)
                .clip(CircleShape)
                .background(com.onshift.app.ui.theme.Primary.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                Icons.Default.Person,
                contentDescription = null,
                modifier = Modifier.size(60.dp),
                tint = com.onshift.app.ui.theme.Primary
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(text = "Worker OS-82F91A", style = MaterialTheme.typography.titleMedium, color = com.onshift.app.ui.theme.TextSecondary)
        Spacer(modifier = Modifier.height(24.dp))

        // Privacy Vault Card
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = com.onshift.app.ui.theme.Surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = stringResource(R.string.privacy_vault),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = stringResource(R.string.hash_chain_status) + ": ", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        text = if (privacyRecord.hashChainValid) stringResource(R.string.valid) else stringResource(R.string.tampered),
                        color = if (privacyRecord.hashChainValid) com.onshift.app.ui.theme.StatusReconciled else com.onshift.app.ui.theme.StatusUnreconciled,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold
                    )
                }
                Text(
                    text = stringResource(R.string.last_verified, privacyRecord.lastVerifiedAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = com.onshift.app.ui.theme.TextSecondary
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Platforms Card
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = com.onshift.app.ui.theme.Surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.select_platforms),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    TextButton(onClick = onEditPlatforms) {
                        Text(text = "Edit", color = com.onshift.app.ui.theme.Primary)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    selectedPlatforms.forEach { platform ->
                        AssistChip(
                            onClick = { },
                            label = { Text(platform) },
                            shape = RoundedCornerShape(8.dp)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Language
        OutlinedButton(
            onClick = onLanguageToggle,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.change_language))
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        Button(
            onClick = onTamperDemo,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = com.onshift.app.ui.theme.StatusUnreconciled),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.demo_tampering), color = Color.White)
        }
        Spacer(modifier = Modifier.height(16.dp))
        
        OutlinedButton(
            onClick = onResetHash,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.reset_hash), color = com.onshift.app.ui.theme.StatusReconciled)
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        TextButton(
            onClick = onRestartDemo
        ) {
            Text(text = "Reset All Data (Demo)", color = Color.Red.copy(alpha = 0.7f))
        }
    }
}
