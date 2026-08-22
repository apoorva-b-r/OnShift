package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.PrivacyRepository
import com.onshift.app.data.model.MockData
import com.onshift.app.data.model.PrivacyRecord
import com.onshift.app.data.vault.LocalEncryptedEvidenceRepository
import com.onshift.app.ui.common.*
import com.onshift.app.ui.theme.*

@Composable
fun PrivacyScreen(
    uiState: UiState<PrivacyRecord>? = null
) {
    val privacyRecord by PrivacyRepository.privacyRecordState.collectAsState()

    if (uiState != null) {
        when (uiState) {
            is UiState.Loading -> UiStateLoadingView()
            is UiState.Error -> UiStateErrorView(message = uiState.message)
            is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.empty_data))
            is UiState.Success -> PrivacyContent(privacyRecord = uiState.data)
        }
    } else {
        PrivacyContent(privacyRecord = privacyRecord)
    }
}

@Composable
fun PrivacyContent(
    privacyRecord: PrivacyRecord
) {
    var requireConsent by remember { mutableStateOf(true) }
    var enforceZkDisclosure by remember { mutableStateOf(true) }
    var localOnlyVault by remember { mutableStateOf(true) }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Page Title
        Text(
            text = stringResource(R.string.privacy_layer_control),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = OnSurface
        )

        // Pseudonymous Worker ID Card
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = null,
                    tint = Primary,
                    modifier = Modifier.size(28.dp)
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.privacy_item_1),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = OnSurface
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = "Real identity and bank details remain encrypted on-device",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }
            }
        }

        // Encrypted Vault State Summary
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Security,
                            contentDescription = null,
                            tint = StatusReconciled,
                            modifier = Modifier.size(24.dp)
                        )
                        Text(
                            text = stringResource(R.string.encrypted_vault_summary),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = OnSurface
                        )
                    }

                    Surface(
                        color = StatusReconciled.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(50)
                    ) {
                        Text(
                            text = "ACTIVE",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = StatusReconciled,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }

                Text(
                    text = stringResource(R.string.vault_active_status),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                    color = Primary
                )

                Text(
                    text = stringResource(R.string.privacy_item_2),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            }
        }

        // Hash Chain Status & Tampering Demo Controls
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.hash_chain_status),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = OnSurface
                    )

                    Surface(
                        color = if (privacyRecord.hashChainValid) StatusReconciled.copy(alpha = 0.15f) else StatusUnreconciled.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(50)
                    ) {
                        Text(
                            text = if (privacyRecord.hashChainValid) stringResource(R.string.valid) else stringResource(R.string.tampered),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (privacyRecord.hashChainValid) StatusReconciled else StatusUnreconciled,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }

                Text(
                    text = stringResource(R.string.last_verified, privacyRecord.lastVerifiedAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            PrivacyRepository.tamperData()
                            try {
                                LocalEncryptedEvidenceRepository.instance.tamperFirstRecord()
                            } catch (_: Exception) {}
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = StatusUnreconciled,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.demo_tampering),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    OutlinedButton(
                        onClick = {
                            PrivacyRepository.resetHashChain()
                            try {
                                LocalEncryptedEvidenceRepository.instance.resetVaultToValid()
                            } catch (_: Exception) {}
                        },
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.weight(1f),
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.reset_hash),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = StatusReconciled
                        )
                    }
                }
            }
        }

        // Interactive Data Sharing & Privacy Toggles
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = stringResource(R.string.data_sharing_controls),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = OnSurface
                )

                Divider()

                PrivacyToggleRow(
                    label = stringResource(R.string.consent_required_toggle),
                    checked = requireConsent,
                    onCheckedChange = { requireConsent = it }
                )

                PrivacyToggleRow(
                    label = stringResource(R.string.zk_disclosure_toggle),
                    checked = enforceZkDisclosure,
                    onCheckedChange = { enforceZkDisclosure = it }
                )

                PrivacyToggleRow(
                    label = stringResource(R.string.local_only_toggle),
                    checked = localOnlyVault,
                    onCheckedChange = { localOnlyVault = it }
                )
            }
        }
    }
}

@Composable
fun PrivacyToggleRow(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = OnSurface,
            modifier = Modifier.weight(1f)
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = OnSurface,
                checkedTrackColor = Primary
            )
        )
    }
}

// Previews for all 4 states
@Preview(showBackground = true, name = "PrivacyScreen Loading")
@Composable
fun PrivacyScreenPreviewLoading() {
    PrivacyScreen(uiState = UiState.Loading)
}

@Preview(showBackground = true, name = "PrivacyScreen Error")
@Composable
fun PrivacyScreenPreviewError() {
    PrivacyScreen(uiState = UiState.Error("Could not reach the server, showing saved data instead"))
}

@Preview(showBackground = true, name = "PrivacyScreen Empty")
@Composable
fun PrivacyScreenPreviewEmpty() {
    PrivacyScreen(uiState = UiState.Empty)
}

@Preview(showBackground = true, name = "PrivacyScreen Populated")
@Composable
fun PrivacyScreenPreviewPopulated() {
    PrivacyScreen(uiState = UiState.Success(MockData.mockPrivacyRecord))
}
