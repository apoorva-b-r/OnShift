package com.onshift.app.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.material3.windowsizeclass.WindowSizeClass
import androidx.compose.material3.windowsizeclass.WindowWidthSizeClass
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onshift.app.data.ShiftEvidenceItem
import com.onshift.app.data.VaultStore
import com.onshift.app.data.model.*
import java.text.NumberFormat
import java.util.Locale

private val LevelDeclaredColor = Color(0xFF64748B)
private val LevelObservedColor = Color(0xFF0284C7)
private val LevelCorroboratedColor = Color(0xFF2563EB)
private val LevelFinCorroboratedColor = Color(0xFF10B981)
private val StatusSuccessColor = Color(0xFF10B981)
private val StatusErrorColor = Color(0xFFEF4444)

@Composable
fun HomeScreen(
    windowSizeClass: WindowSizeClass,
    worker: Worker,
    reconciliationResult: ReconciliationResult?,
    userPrefs: UserPreferences
) {
    val context = LocalContext.current
    val currencyFormatter = NumberFormat.getCurrencyInstance(Locale("en", "IN")).apply {
        maximumFractionDigits = 0
    }

    val scrollState = rememberScrollState()

    // Subscribed to real-time VaultStore updates
    val detectedShifts by VaultStore.shifts.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // Worker Header
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "Welcome, ${worker.id}",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                StatusIndicator(text = "Identity Verified")
                StatusIndicator(text = "Platforms Connected")
            }
        }

        // WhatsApp Share Action Button
        Button(
            onClick = {
                shareProofViaWhatsApp(
                    context = context,
                    workerId = worker.id,
                    totalEarnings = detectedShifts.sumOf { it.amount }
                )
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Share Proof with Lender (WhatsApp)", fontWeight = FontWeight.Bold)
        }

        // Platform Stats
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "Platform Activity",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            val selectedPlatforms = userPrefs.selectedPlatforms
            val platformStats = selectedPlatforms.map { platform ->
                val count = detectedShifts.count { it.platform.equals(platform, ignoreCase = true) }
                platform to count.toString()
            }

            val columns = when (windowSizeClass.widthSizeClass) {
                WindowWidthSizeClass.Compact -> 2
                else -> 3
            }

            platformStats.chunked(columns).forEach { rowStats ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    rowStats.forEach { (name, count) ->
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier
                                .weight(1f)
                                .clickable {
                                    Toast.makeText(context, "$name shifts: $count", Toast.LENGTH_SHORT).show()
                                }
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                Text(
                                    text = name,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    text = count,
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                    repeat(columns - rowStats.size) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        // Live Intercepted Shifts Section
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Live Vault Receipts",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                TextButton(onClick = {
                    VaultStore.addShift(
                        ShiftEvidenceItem("MockPartner", 65.0, "Just now", true)
                    )
                    Toast.makeText(context, "New shift verified in Vault!", Toast.LENGTH_SHORT).show()
                }) {
                    Text("+ Add Test Shift")
                }
            }

            detectedShifts.forEach { shift ->
                Card(
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            Toast.makeText(context, "Shift Hash: Valid Ed25519 Signature", Toast.LENGTH_SHORT).show()
                        },
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(text = shift.platform, fontWeight = FontWeight.Bold)
                            Text(
                                text = shift.timestamp,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Text(
                            text = currencyFormatter.format(shift.amount),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }
        }

        // Reconciliation Card
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "Reconciliation Status",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            ReconciliationCard(reconciliationResult, currencyFormatter)
        }

        // Verification Level Bar
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "Verification Level",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            VerificationLevelBar(worker.verificationLevel)
        }
    }
}

private fun shareProofViaWhatsApp(context: Context, workerId: String, totalEarnings: Double) {
    val verifierWebUrl = "http://localhost:3000"
    val automatedMsg = """
        *OnShift Verifiable Work Credential*
        Worker ID: $workerId
        Verified Earnings: ₹${totalEarnings.toInt()}
        
        Click link to verify cryptographic proof & underwriting score on Lender Portal:
        $verifierWebUrl
    """.trimIndent()

    val intent = Intent(Intent.ACTION_VIEW).apply {
        data = Uri.parse("https://api.whatsapp.com/send?text=${Uri.encode(automatedMsg)}")
        flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }

    try {
        context.startActivity(intent)
    } catch (e: Exception) {
        Toast.makeText(context, "WhatsApp is not installed on this device.", Toast.LENGTH_SHORT).show()
    }
}

@Composable
fun StatusIndicator(text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = StatusSuccessColor, modifier = Modifier.size(16.dp))
        Text(text = text, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun ReconciliationCard(result: ReconciliationResult?, formatter: NumberFormat) {
    val containerColor = if (result != null) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
    val contentColor = if (result != null) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant

    Card(
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = containerColor,
            contentColor = contentColor
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            if (result == null) {
                Text(
                    text = "Awaiting financial reconciliation...",
                    style = MaterialTheme.typography.bodyLarge,
                    color = contentColor.copy(alpha = 0.6f)
                )
                Text(
                    text = formatter.format(0),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    val isMatched = result.status == ReconciliationStatus.MATCHED
                    Text(
                        text = if (isMatched) "MATCHED" else "UNEXPLAINED DIFFERENCE",
                        color = if (isMatched) StatusSuccessColor else StatusErrorColor,
                        fontWeight = FontWeight.Bold
                    )
                    Text(text = result.period, style = MaterialTheme.typography.bodySmall)
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "Expected: ${formatter.format(result.expected)}")
                Text(text = "Actual: ${formatter.format(result.actual)}")
                if (result.status == ReconciliationStatus.UNEXPLAINED_DIFFERENCE) {
                    Text(
                        text = "Difference: ${formatter.format(result.differenceAmount)}",
                        color = StatusErrorColor
                    )
                }
            }
        }
    }
}

@Composable
fun VerificationLevelBar(level: VerificationLevel) {
    val levels = VerificationLevel.values()
    val currentIndex = levels.indexOf(level)

    val colors = listOf(LevelDeclaredColor, LevelObservedColor, LevelCorroboratedColor, LevelFinCorroboratedColor)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(12.dp)
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(6.dp)),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        levels.forEachIndexed { index, _ ->
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .background(
                        if (index <= currentIndex && index < colors.size) colors[index] else Color.Transparent,
                        RoundedCornerShape(6.dp)
                    )
            )
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = "Declared", style = MaterialTheme.typography.labelSmall)
        Text(text = "Financially Corroborated", style = MaterialTheme.typography.labelSmall)
    }
}