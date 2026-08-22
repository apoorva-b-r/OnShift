package com.onshift.app.ui.screens

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onshift.app.data.hashchain.HashChain
import com.onshift.app.data.vault.EvidenceRecord
import com.onshift.app.data.vault.LocalEncryptedEvidenceRepository
import com.onshift.app.notifications.TesseractOcrScanner
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EvidenceScreen() {
    val repository = remember { LocalEncryptedEvidenceRepository.instance }
    var evidenceList by remember { mutableStateOf(repository.getAllEvidence()) }
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isScanning by remember { mutableStateOf(false) }

    fun refreshList() {
        evidenceList = repository.getAllEvidence()
    }

    // 1. Updated Contract to OpenDocument for broad file-format support (PDF + Images)
    val pickDocumentLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) {
            isScanning = true
            coroutineScope.launch {
                try {
                    val parseResult = TesseractOcrScanner.scanAndParseDocument(context, uri)
                    if (parseResult.success && parseResult.evidence?.amount != null) {
                        repository.createAndSaveEvidence(
                            source = "TESSERACT_OCR",
                            platform = parseResult.evidence.platform.name,
                            amount = parseResult.evidence.amount
                        )
                        refreshList()
                        Toast.makeText(
                            context,
                            "Parsed ₹${parseResult.evidence.amount} (${parseResult.evidence.platform}) via Tesseract",
                            Toast.LENGTH_LONG
                        ).show()
                    } else {
                        Toast.makeText(
                            context,
                            "Could not extract amount. Check image or PDF clarity.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(context, "OCR Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                } finally {
                    isScanning = false
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Evidence Vault", fontWeight = FontWeight.Bold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
        ) {
            // Action Buttons Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Simulate Realtime Notification Button
                Button(
                    onClick = {
                        val samplePlatforms = listOf("ZOMATO", "SWIGGY", "UBER")
                        val sampleAmounts = listOf(245.0, 312.5, 180.0, 95.0)
                        repository.createAndSaveEvidence(
                            source = "NOTIFICATION_SIMULATION",
                            platform = samplePlatforms.random(),
                            amount = sampleAmounts.random()
                        )
                        refreshList()
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Simulate Push", fontSize = 12.sp)
                }

                // 2. Updated OCR Upload Button to launch both Images & PDFs
                Button(
                    onClick = {
                        pickDocumentLauncher.launch(arrayOf("image/*", "application/pdf"))
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary),
                    modifier = Modifier.weight(1f),
                    enabled = !isScanning
                ) {
                    Text(if (isScanning) "Scanning..." else "Upload Doc / Slip", fontSize = 12.sp)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Verify Hash Chain Integrity Button
            OutlinedButton(
                onClick = {
                    val records = repository.getAllEvidence()
                    var isValid = true
                    var prevHash = "GENESIS_0000000000000000000000000000000000000000000000000000000000000000"

                    for (record in records) {
                        if (record.previousHash != prevHash) {
                            isValid = false
                            break
                        }
                        val computed = HashChain.calculateRecordHash(record, record.previousHash)
                        if (computed != record.integrityHash) {
                            isValid = false
                            break
                        }
                        prevHash = record.integrityHash
                    }

                    val msg = if (isValid) "Hash-Chain Verified! Vault is tamper-free." else "Integrity Compromised!"
                    Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Verify SHA-256 Chain Integrity")
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Captured Records (${evidenceList.size})",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )

            Spacer(modifier = Modifier.height(8.dp))

            if (evidenceList.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No evidence recorded yet.\nSimulate a push notification or upload an earnings slip / PDF.",
                        color = Color.Gray,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(evidenceList) { item ->
                        EvidenceCard(item)
                    }
                }
            }
        }
    }
}

@Composable
fun EvidenceCard(item: EvidenceRecord) {
    val dateString = remember(item.timestamp) {
        val sdf = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale.getDefault())
        sdf.format(Date(item.timestamp))
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = item.platform,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "₹${item.amount}",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 18.sp
                )
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Source: ${item.source} • $dateString",
                fontSize = 11.sp,
                color = Color.Gray
            )

            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "Integrity Hash: ${item.integrityHash.take(18)}...",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "Prev Hash: ${item.previousHash.take(18)}...",
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}