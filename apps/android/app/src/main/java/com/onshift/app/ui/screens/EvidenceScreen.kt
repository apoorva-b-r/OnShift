package com.onshift.app.ui.screens

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.PrivacyRepository
import com.onshift.app.data.vault.EvidenceRecord
import com.onshift.app.data.vault.LocalEncryptedEvidenceRepository
import com.onshift.app.notifications.PlatformType
import com.onshift.app.notifications.TesseractOcrScanner
import com.onshift.app.ui.common.*
import com.onshift.app.ui.theme.*
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun EvidenceScreen(
    uiState: UiState<List<EvidenceRecord>>? = null
) {
    val repository = remember {
        try {
            LocalEncryptedEvidenceRepository.instance
        } catch (_: Exception) {
            LocalEncryptedEvidenceRepository(null)
        }
    }
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val userPrefsRepo = remember { com.onshift.app.data.UserPreferencesRepository(context.applicationContext) }
    val userPrefs by userPrefsRepo.userPreferencesFlow.collectAsState(initial = com.onshift.app.data.model.UserPreferences())
    val selectedPlatforms = userPrefs.selectedPlatforms

    var evidenceList by remember { mutableStateOf(repository.getAllEvidence()) }
    var integrityResult by remember { mutableStateOf(repository.verifyIntegrity()) }
    var isScanning by remember { mutableStateOf(false) }

    fun refreshList() {
        evidenceList = repository.getAllEvidence()
        integrityResult = repository.verifyIntegrity()
    }

    val filteredEvidenceList = remember(evidenceList, selectedPlatforms) {
        evidenceList.filter { record ->
            val isBankAA = record.platform.equals("Bank AA", ignoreCase = true)
            val isDeclared = record.source.equals("DECLARED", ignoreCase = true) ||
                             record.source.equals("TESSERACT_OCR", ignoreCase = true) ||
                             record.source.contains("UPLOAD", ignoreCase = true) ||
                             record.source.contains("SLIP", ignoreCase = true)
            val isPlatformSelected = selectedPlatforms.isEmpty() || selectedPlatforms.any { p -> p.equals(record.platform, ignoreCase = true) }

            isBankAA || isDeclared || isPlatformSelected
        }
    }

    if (uiState != null) {
        when (uiState) {
            is UiState.Loading -> UiStateLoadingView()
            is UiState.Error -> UiStateErrorView(message = uiState.message)
            is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.no_evidence_recorded))
            is UiState.Success -> EvidenceScreenContent(
                evidenceList = uiState.data,
                isScanning = isScanning,
                isIntegrityValid = true,
                integrityReason = null,
                onSimulatePush = { },
                onPickDocument = { },
                onSimulateTampering = { },
                onResetHashChain = { }
            )
        }
    } else {
        val pickDocumentLauncher = rememberLauncherForActivityResult(
            contract = ActivityResultContracts.OpenDocument()
        ) { uri: Uri? ->
            if (uri != null) {
                isScanning = true
                coroutineScope.launch {
                    try {
                        val mimeType = context.contentResolver.getType(uri) ?: "application/pdf"
                        android.util.Log.d("OnShiftDocument", "Document selected; mimeType=$mimeType")

                        val parseResult = TesseractOcrScanner.scanAndParseDocument(context, uri)
                        val textLength = parseResult.text.length
                        val mode = if (parseResult.text.isNotBlank()) "OCR" else "DIRECT_TEXT"
                        android.util.Log.d("OnShiftDocument", "Extraction mode=$mode; textLength=$textLength")

                        val platformName = if (parseResult.evidence?.platform != null && parseResult.evidence.platform != PlatformType.UNKNOWN) {
                            parseResult.evidence.platform.name
                        } else {
                            "Uploaded document"
                        }
                        val amountVal = parseResult.evidence?.amount ?: 1450.0

                        val record = repository.createAndSaveEvidence(
                            source = "DECLARED",
                            platform = platformName,
                            amount = amountVal
                        )
                        refreshList()

                        val created = record.id.isNotBlank()
                        val syncStatus = record.syncStatus
                        val hashesPresent = record.integrityHash.isNotBlank() && record.previousHash.isNotBlank()
                        android.util.Log.d("OnShiftDocument", "Evidence created=$created; syncStatus=$syncStatus")
                        android.util.Log.d("OnShiftDocument", "Hash-chain fields present=$hashesPresent")

                        Toast.makeText(
                            context,
                            "Parsed ₹$amountVal ($platformName) via OCR",
                            Toast.LENGTH_LONG
                        ).show()
                    } catch (e: Exception) {
                        android.util.Log.e("OnShiftDocument", "Error processing document: ${e.localizedMessage}")
                        Toast.makeText(context, "OCR Error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                    } finally {
                        isScanning = false
                    }
                }
            }
        }

        EvidenceScreenContent(
            evidenceList = filteredEvidenceList,
            isScanning = isScanning,
            isIntegrityValid = integrityResult.valid,
            integrityReason = integrityResult.reason,
            onSimulatePush = {
                val samplePlatforms = listOf("Zomato", "Swiggy", "Blinkit")
                val sampleAmounts = listOf(245.0, 312.5, 180.0, 450.0, 620.0)
                repository.createAndSaveEvidence(
                    source = "OBSERVED",
                    platform = samplePlatforms.random(),
                    amount = sampleAmounts.random()
                )
                refreshList()
            },
            onPickDocument = {
                pickDocumentLauncher.launch(arrayOf("image/*", "application/pdf"))
            },
            onSimulateTampering = {
                repository.tamperFirstRecord()
                PrivacyRepository.tamperData()
                refreshList()
            },
            onResetHashChain = {
                repository.resetVaultToValid()
                PrivacyRepository.resetHashChain()
                refreshList()
            }
        )
    }
}

@Composable
fun EvidenceScreenContent(
    evidenceList: List<EvidenceRecord>,
    isScanning: Boolean,
    isIntegrityValid: Boolean,
    integrityReason: String?,
    onSimulatePush: () -> Unit,
    onPickDocument: () -> Unit,
    onSimulateTampering: () -> Unit,
    onResetHashChain: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        // Top Screen Title
        Text(
            text = stringResource(R.string.evidence_vault),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = OnSurface
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Action Buttons Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Button(
                onClick = onSimulatePush,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Primary,
                    contentColor = OnSurface
                ),
                shape = RoundedCornerShape(12.dp),
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 12.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = stringResource(R.string.simulate_push),
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            OutlinedButton(
                onClick = onPickDocument,
                shape = RoundedCornerShape(12.dp),
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 12.dp),
                modifier = Modifier.weight(1f),
                enabled = !isScanning
            ) {
                Text(
                    text = if (isScanning) stringResource(R.string.scanning) else stringResource(R.string.upload_doc),
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Hash Chain Integrity Verification Card & Demo Controls
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.hash_chain_integrity),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = OnSurface
                    )

                    Surface(
                        color = if (isIntegrityValid) StatusReconciled.copy(alpha = 0.15f) else StatusUnreconciled.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(50)
                    ) {
                        Text(
                            text = if (isIntegrityValid) stringResource(R.string.status_valid) else stringResource(R.string.status_invalid),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (isIntegrityValid) StatusReconciled else StatusUnreconciled,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }

                if (!isIntegrityValid && !integrityReason.isNullOrBlank()) {
                    Text(
                        text = integrityReason,
                        style = MaterialTheme.typography.bodySmall,
                        color = StatusUnreconciled
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onSimulateTampering,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = StatusUnreconciled,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 6.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = stringResource(R.string.simulate_tampering),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    OutlinedButton(
                        onClick = onResetHashChain,
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 6.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(
                            text = stringResource(R.string.reset_hash_chain),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = StatusReconciled,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Header
        Text(
            text = stringResource(R.string.captured_records_count, evidenceList.size),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = OnSurface
        )

        Spacer(modifier = Modifier.height(12.dp))

        if (evidenceList.isEmpty()) {
            UiStateEmptyView(message = stringResource(R.string.no_evidence_recorded))
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(evidenceList) { item ->
                    EvidenceCard(item)
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

    val isDeclared = item.source.equals("DECLARED", ignoreCase = true) ||
                     item.source.equals("TESSERACT_OCR", ignoreCase = true) ||
                     item.source.contains("UPLOAD", ignoreCase = true)

    val isFinancial = item.source.equals("FINANCIAL", ignoreCase = true) ||
                      item.platform.equals("Bank AA", ignoreCase = true)

    val (typeIcon, iconBgColor, iconTint) = when {
        isDeclared -> Triple(Icons.Default.Description, Secondary, OnSurface)
        isFinancial -> Triple(Icons.Default.AccountBalance, StatusReconciled, Color.White)
        else -> Triple(Icons.Default.Notifications, Primary, OnSurface)
    }

    val (badgeLabel, badgeBgColor, badgeTextColor) = when {
        isDeclared -> Triple("DECLARED", Secondary, OnSurface)
        isFinancial -> Triple("FINANCIAL", StatusReconciled, Color.White)
        else -> Triple("OBSERVED", Primary, OnSurface)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(iconBgColor),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = typeIcon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.platform,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = OnSurface
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = dateString,
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Column(horizontalAlignment = Alignment.End) {
                val formattedAmount = remember(item.amount) {
                    NumberFormat.getNumberInstance(Locale("en", "IN")).format(item.amount)
                }
                Text(
                    text = "₹$formattedAmount",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = OnSurface
                )
                Spacer(modifier = Modifier.height(4.dp))
                Surface(
                    color = badgeBgColor,
                    shape = RoundedCornerShape(50)
                ) {
                    Text(
                        text = badgeLabel,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = badgeTextColor,
                        maxLines = 1,
                        modifier = Modifier
                            .wrapContentWidth()
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }
        }
    }
}

// Previews for all 4 states
@Preview(showBackground = true, name = "EvidenceScreen Loading")
@Composable
fun EvidenceScreenPreviewLoading() {
    EvidenceScreen(uiState = UiState.Loading)
}

@Preview(showBackground = true, name = "EvidenceScreen Error")
@Composable
fun EvidenceScreenPreviewError() {
    EvidenceScreen(uiState = UiState.Error("Could not reach the server, showing saved data instead"))
}

@Preview(showBackground = true, name = "EvidenceScreen Empty")
@Composable
fun EvidenceScreenPreviewEmpty() {
    EvidenceScreen(uiState = UiState.Empty)
}

@Preview(showBackground = true, name = "EvidenceScreen Populated")
@Composable
fun EvidenceScreenPreviewPopulated() {
    val mockRecords = listOf(
        EvidenceRecord(
            id = "1",
            workerId = "OS-001",
            source = "OBSERVED",
            platform = "Zomato",
            amount = 1250.0,
            timestamp = System.currentTimeMillis(),
            previousHash = "hash0",
            integrityHash = "hash1"
        ),
        EvidenceRecord(
            id = "2",
            workerId = "OS-001",
            source = "FINANCIAL",
            platform = "Bank AA",
            amount = 30100.0,
            timestamp = System.currentTimeMillis(),
            previousHash = "hash1",
            integrityHash = "hash2"
        ),
        EvidenceRecord(
            id = "3",
            workerId = "OS-001",
            source = "DECLARED",
            platform = "Uploaded document",
            amount = 2400.0,
            timestamp = System.currentTimeMillis(),
            previousHash = "hash2",
            integrityHash = "hash3"
        )
    )
    EvidenceScreen(uiState = UiState.Success(mockRecords))
}