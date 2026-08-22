package com.onshift.app.ui.screens

import android.app.Activity
import android.util.Log
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.PrivacyRepository
import com.onshift.app.data.UserPreferencesRepository
import com.onshift.app.data.model.MockData
import com.onshift.app.data.model.PrivacyRecord
import com.onshift.app.data.model.UserPreferences
import com.onshift.app.ui.common.*
import com.onshift.app.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun ProfileScreen(
    onTamperDemo: () -> Unit = {},
    onResetHash: () -> Unit = {},
    onRestartDemo: () -> Unit = {},
    uiState: UiState<PrivacyRecord>? = null
) {
    if (uiState != null) {
        when (uiState) {
            is UiState.Loading -> UiStateLoadingView()
            is UiState.Error -> UiStateErrorView(message = uiState.message)
            is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.no_platforms_selected))
            is UiState.Success -> ProfileContent(
                privacyRecord = uiState.data,
                currentLanguage = "en",
                selectedPlatforms = listOf("Zomato", "Swiggy"),
                lastBackedUpAt = null,
                onUpdateLanguage = { },
                onUpdatePlatforms = { },
                onUpdateLastBackedUpAt = { },
                onTamperDemo = onTamperDemo,
                onResetHash = onResetHash,
                onRestartDemo = onRestartDemo
            )
        }
    } else {
        val context = LocalContext.current
        val coroutineScope = rememberCoroutineScope()
        val repository = remember { UserPreferencesRepository(context.applicationContext) }

        val privacyRecord by PrivacyRepository.privacyRecordState.collectAsState()
        val userPreferences by repository.userPreferencesFlow.collectAsState(initial = UserPreferences())
        val currentLanguage = userPreferences.language
        val selectedPlatforms = userPreferences.selectedPlatforms
        val lastBackedUpAt = userPreferences.lastBackedUpAt

        ProfileContent(
            privacyRecord = privacyRecord,
            currentLanguage = currentLanguage,
            selectedPlatforms = selectedPlatforms,
            lastBackedUpAt = lastBackedUpAt,
            onUpdateLanguage = { newLang ->
                coroutineScope.launch {
                    repository.updateLanguage(newLang)
                    Log.d("LanguageSwitch", "Setting application locale to: $newLang")
                    AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(newLang))
                    (context as? Activity)?.recreate()
                }
            },
            onUpdatePlatforms = { platforms ->
                coroutineScope.launch {
                    repository.updateSelectedPlatforms(platforms)
                }
            },
            onUpdateLastBackedUpAt = { timestamp ->
                coroutineScope.launch {
                    repository.updateLastBackedUpAt(timestamp)
                }
            },
            onTamperDemo = onTamperDemo,
            onResetHash = onResetHash,
            onRestartDemo = {
                coroutineScope.launch {
                    PrivacyRepository.resetHashChain()
                    repository.clearPreferences()
                    onRestartDemo()
                    (context as? Activity)?.recreate()
                }
            }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileContent(
    privacyRecord: PrivacyRecord,
    currentLanguage: String,
    selectedPlatforms: List<String>,
    lastBackedUpAt: Long?,
    onUpdateLanguage: (String) -> Unit,
    onUpdatePlatforms: (List<String>) -> Unit,
    onUpdateLastBackedUpAt: (Long) -> Unit,
    onTamperDemo: () -> Unit,
    onResetHash: () -> Unit,
    onRestartDemo: () -> Unit
) {
    var showPlatformEditDialog by remember { mutableStateOf(false) }
    var isBackingUp by remember { mutableStateOf(false) }
    var backupProgress by remember { mutableIntStateOf(0) }
    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    val formattedLastBackedUp = remember(lastBackedUpAt) {
        if (lastBackedUpAt != null) {
            val sdf = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault())
            sdf.format(Date(lastBackedUpAt))
        } else {
            null
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(100.dp)
                .clip(CircleShape)
                .background(Primary.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                Icons.Default.Person,
                contentDescription = null,
                modifier = Modifier.size(60.dp),
                tint = Primary
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.worker_id_label, "OS-82F91A"),
            style = MaterialTheme.typography.titleMedium,
            color = TextSecondary
        )
        Spacer(modifier = Modifier.height(24.dp))

        // Privacy Vault Card
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface)
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
                        color = if (privacyRecord.hashChainValid) StatusReconciled else StatusUnreconciled,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold
                    )
                }
                Text(
                    text = stringResource(R.string.last_verified, privacyRecord.lastVerifiedAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Platforms Card
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface)
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
                    TextButton(onClick = { showPlatformEditDialog = true }) {
                        Text(text = stringResource(R.string.edit_platforms), color = Primary)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                if (selectedPlatforms.isEmpty()) {
                    Text(
                        text = stringResource(R.string.no_platforms_selected),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                } else {
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
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Backup & Restore Card (Positioned below Platforms, above Tampering Demo)
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = stringResource(R.string.backup_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = OnSurface
                )

                Text(
                    text = stringResource(R.string.backup_desc),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )

                if (isBackingUp) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        LinearProgressIndicator(
                            progress = { backupProgress / 100f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp),
                            color = Primary,
                            trackColor = Color.LightGray.copy(alpha = 0.3f),
                            strokeCap = StrokeCap.Round
                        )
                        Text(
                            text = stringResource(R.string.backed_up_pct, backupProgress),
                            style = MaterialTheme.typography.labelSmall,
                            color = Primary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                if (formattedLastBackedUp != null && !isBackingUp) {
                    Text(
                        text = stringResource(R.string.last_backed_up, formattedLastBackedUp),
                        style = MaterialTheme.typography.bodySmall,
                        color = StatusReconciled,
                        fontWeight = FontWeight.Medium
                    )
                }

                OutlinedButton(
                    onClick = {
                        if (!isBackingUp) {
                            isBackingUp = true
                            backupProgress = 0
                            coroutineScope.launch {
                                for (p in 0..100 step 2) {
                                    delay(40L)
                                    backupProgress = p
                                }
                                backupProgress = 100
                                isBackingUp = false
                                onUpdateLastBackedUpAt(System.currentTimeMillis())
                            }
                        }
                    },
                    enabled = !isBackingUp,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = if (formattedLastBackedUp != null) stringResource(R.string.back_up_again) else stringResource(R.string.back_up_now),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        OutlinedButton(
            onClick = {
                val newLang = if (currentLanguage == "hi") "en" else "hi"
                onUpdateLanguage(newLang)
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            val displayLang = if (currentLanguage == "hi") stringResource(R.string.hindi) else stringResource(R.string.english)
            Text(text = "${stringResource(R.string.change_language)} ($displayLang)")
        }

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = {
                PrivacyRepository.tamperData()
                onTamperDemo()
            },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = StatusUnreconciled),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.demo_tampering), color = Color.White)
        }
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedButton(
            onClick = {
                PrivacyRepository.resetHashChain()
                onResetHash()
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.reset_hash), color = StatusReconciled)
        }

        Spacer(modifier = Modifier.height(24.dp))

        TextButton(onClick = onRestartDemo) {
            Text(text = stringResource(R.string.reset_all_data_demo), color = Color.Red.copy(alpha = 0.7f))
        }
    }

    if (showPlatformEditDialog) {
        val availablePlatforms = listOf(
            stringResource(R.string.zomato),
            stringResource(R.string.swiggy),
            stringResource(R.string.blinkit)
        )
        var tempSelections by remember(selectedPlatforms) { mutableStateOf(selectedPlatforms.toSet()) }

        AlertDialog(
            onDismissRequest = { showPlatformEditDialog = false },
            title = { Text(text = stringResource(R.string.select_platforms), fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    availablePlatforms.forEach { platform ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    tempSelections = if (tempSelections.contains(platform)) {
                                        tempSelections - platform
                                    } else {
                                        tempSelections + platform
                                    }
                                }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = tempSelections.contains(platform),
                                onCheckedChange = { checked ->
                                    tempSelections = if (checked) {
                                        tempSelections + platform
                                    } else {
                                        tempSelections - platform
                                    }
                                }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = platform, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onUpdatePlatforms(tempSelections.toList())
                        showPlatformEditDialog = false
                    },
                    enabled = tempSelections.isNotEmpty()
                ) {
                    Text(text = stringResource(R.string.continue_btn))
                }
            },
            dismissButton = {
                TextButton(onClick = { showPlatformEditDialog = false }) {
                    Text(text = stringResource(R.string.cancel))
                }
            }
        )
    }
}

// Previews for all 4 states
@Preview(showBackground = true, name = "ProfileScreen Loading")
@Composable
fun ProfileScreenPreviewLoading() {
    ProfileScreen(uiState = UiState.Loading)
}

@Preview(showBackground = true, name = "ProfileScreen Error")
@Composable
fun ProfileScreenPreviewError() {
    ProfileScreen(uiState = UiState.Error("Could not reach the server, showing saved data instead"))
}

@Preview(showBackground = true, name = "ProfileScreen Empty")
@Composable
fun ProfileScreenPreviewEmpty() {
    ProfileScreen(uiState = UiState.Empty)
}

@Preview(showBackground = true, name = "ProfileScreen Populated")
@Composable
fun ProfileScreenPreviewPopulated() {
    ProfileScreen(uiState = UiState.Success(MockData.mockPrivacyRecord))
}
