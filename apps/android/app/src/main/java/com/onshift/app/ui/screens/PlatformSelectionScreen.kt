package com.onshift.app.ui.screens

import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onshift.app.R

fun isNotificationListenerGranted(context: Context): Boolean {
    val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
    return flat != null && flat.contains(context.packageName)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PlatformSelectionScreen(
    initialSelections: List<String> = emptyList(),
    showBackButton: Boolean = false,
    onBack: () -> Unit = {},
    onPlatformsSelected: (List<String>) -> Unit
) {
    val context = LocalContext.current
    val platforms = listOf(
        stringResource(R.string.zomato),
        stringResource(R.string.swiggy),
        stringResource(R.string.blinkit)
    )
    var selectedPlatforms by remember { mutableStateOf(initialSelections.toSet()) }
    var showPermissionDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        if (showBackButton) {
            IconButton(onClick = onBack, modifier = Modifier.padding(bottom = 16.dp)) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back")
            }
        }
        
        Text(
            text = stringResource(R.string.select_platforms),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.platform_selection_desc),
            style = MaterialTheme.typography.bodyMedium,
            color = com.onshift.app.ui.theme.TextSecondary
        )
        Spacer(modifier = Modifier.height(24.dp))

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(platforms) { platform ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = com.onshift.app.ui.theme.Surface)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 56.dp)
                            .padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = selectedPlatforms.contains(platform),
                            onCheckedChange = { checked ->
                                selectedPlatforms = if (checked) {
                                    selectedPlatforms + platform
                                } else {
                                    selectedPlatforms - platform
                                }
                            }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = platform, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Button(
            onClick = {
                if (isNotificationListenerGranted(context)) {
                    onPlatformsSelected(selectedPlatforms.toList())
                } else {
                    showPermissionDialog = true
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = selectedPlatforms.isNotEmpty(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.continue_btn))
        }
    }

    if (showPermissionDialog) {
        AlertDialog(
            onDismissRequest = { /* Compulsory dialog — prevent accidental dismiss without choice */ },
            icon = {
                Icon(
                    Icons.Default.NotificationsActive,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(36.dp)
                )
            },
            title = {
                Text(
                    text = "Notification Access Required",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "To capture your real payout and order earnings evidence from your selected delivery apps, OnShift requires Notification Access permission:",
                        style = MaterialTheme.typography.bodyMedium,
                        color = com.onshift.app.ui.theme.TextSecondary
                    )

                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        selectedPlatforms.forEach { appName ->
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = MaterialTheme.colorScheme.primaryContainer,
                                contentColor = MaterialTheme.colorScheme.onPrimaryContainer
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Text(
                                        text = appName,
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }
                    }

                    Text(
                        text = "Tap below to open settings and turn ON 'OnShift' under Notification Access.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Medium
                    )
                }
            },
            confirmButton = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            try {
                                context.startActivity(intent)
                            } catch (_: Exception) {
                                val fallbackIntent = Intent(Settings.ACTION_SETTINGS).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                context.startActivity(fallbackIntent)
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Enable Notification Access")
                    }

                    OutlinedButton(
                        onClick = {
                            showPermissionDialog = false
                            onPlatformsSelected(selectedPlatforms.toList())
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("I've Enabled It / Continue")
                    }
                }
            },
            dismissButton = null
        )
    }
}
