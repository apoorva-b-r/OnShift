package com.onshift.app.ui.screens

import android.content.Context
import android.content.Intent
import android.util.Base64
import android.widget.Toast
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.google.gson.GsonBuilder
import com.onshift.app.R
import com.onshift.app.data.model.Credential
import com.onshift.app.data.model.MockData
import com.onshift.app.data.model.VerificationLevel
import com.onshift.app.ui.common.*
import com.onshift.app.ui.theme.Primary
import com.onshift.app.ui.theme.StatusReconciled
import com.onshift.app.ui.theme.Surface
import com.onshift.app.ui.theme.TextSecondary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import android.util.Log
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/** External verifier / lender portal (Vercel). */
const val VERIFIER_URL = "https://on-shift-verifier-web-22pj.vercel.app/"

fun generateVerificationLink(credential: Credential): String {
    val gson = GsonBuilder().setPrettyPrinting().create()
    val jsonString = gson.toJson(credential)
    val encodedData = Base64.encodeToString(
        jsonString.toByteArray(Charsets.UTF_8),
        Base64.URL_SAFE or Base64.NO_WRAP
    )
    return "${VERIFIER_URL}?data=${encodedData}"
}

private fun safeLogD(tag: String, msg: String, throwable: Throwable? = null) {
    try {
        if (throwable != null) {
            Log.d(tag, msg, throwable)
        } else {
            Log.d(tag, msg)
        }
    } catch (t: Throwable) {
        // Ignored in desktop JVM unit test environment
    }
}

suspend fun shortenUrl(longUrl: String): String = withContext(Dispatchers.IO) {
    try {
        val formBody = FormBody.Builder()
            .add("format", "simple")
            .add("url", longUrl)
            .build()

        val client = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build()

        val request = Request.Builder()
            .url("https://is.gd/create.php")
            .post(formBody)
            .build()

        val response = client.newCall(request).execute()
        val body = response.body?.string()?.trim()
        safeLogD("CredentialShare", "is.gd response: $body")

        if (response.isSuccessful && !body.isNullOrEmpty() && !body.startsWith("Error:") && body.startsWith("http")) {
            return@withContext body
        }
    } catch (e: Exception) {
        safeLogD("CredentialShare", "is.gd request error: ${e.message}", e)
    }
    return@withContext longUrl
}

fun shareCredential(context: Context, verificationLink: String) {
    val shareMessage = context.getString(R.string.share_credential_message, verificationLink)

    val sendIntent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, shareMessage)
    }

    context.startActivity(Intent.createChooser(sendIntent, context.getString(R.string.share_with_lender)))
}

@Composable
fun CredentialScreen(
    credential: Credential? = null,
    disclosedClaims: List<String>? = null,
    onBackToClaims: () -> Unit = {},
    uiState: UiState<Credential>? = null
) {
    if (uiState != null) {
        when (uiState) {
            is UiState.Loading -> UiStateLoadingView()
            is UiState.Error -> UiStateErrorView(message = uiState.message)
            is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.empty_credential))
            is UiState.Success -> CredentialContent(onBackToClaims, uiState.data, disclosedClaims)
        }
    } else if (credential != null) {
        CredentialContent(onBackToClaims, credential, disclosedClaims)
    } else {
        UiStateEmptyView(message = stringResource(R.string.empty_credential))
    }
}

@Composable
fun CredentialContent(
    onBackToClaims: () -> Unit,
    credential: Credential?,
    disclosedClaims: List<String>? = null
) {
    if (credential == null) {
        UiStateEmptyView(message = stringResource(R.string.empty_credential))
        return
    }

    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val coroutineScope = rememberCoroutineScope()
    var showShareDialog by remember { mutableStateOf(false) }
    var isShortening by remember { mutableStateOf(false) }
    var activeVerificationLink by remember { mutableStateOf<String?>(null) }
    val claimsToDisplay = disclosedClaims ?: credential.includedClaims

    val showIdentity = claimsToDisplay.isEmpty() || claimsToDisplay.any { it.contains("Identity", ignoreCase = true) || it.contains("Name", ignoreCase = true) }
    val showIncome = claimsToDisplay.isEmpty() || claimsToDisplay.any { it.contains("Income", ignoreCase = true) }
    val showLevel = claimsToDisplay.isEmpty() || claimsToDisplay.any { it.contains("Level", ignoreCase = true) || it.contains("Verification", ignoreCase = true) }
    val showReconciliation = claimsToDisplay.isEmpty() || claimsToDisplay.any { it.contains("Reconciliation", ignoreCase = true) || it.contains("MATCHED", ignoreCase = true) }
    val showOrders = claimsToDisplay.any { it.contains("Orders", ignoreCase = true) || it.contains("Breakdown", ignoreCase = true) }
    val showTimestamps = claimsToDisplay.any { it.contains("Timestamps", ignoreCase = true) }
    val showLocation = claimsToDisplay.any { it.contains("Location", ignoreCase = true) }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            IconButton(onClick = onBackToClaims) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back")
            }
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = stringResource(R.string.signed_portable_credential),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.income_credential),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Primary
                    )
                    // Only show VERIFIED badge if we have a valid verification level from backend
                    if (credential.verificationLevel != null && credential.verifiedIncome != null && credential.verifiedIncome!! > 0) {
                        CredentialStatusBadge(
                            text = "VERIFIED",
                            containerColor = StatusReconciled
                        )
                    }
                }

                Divider()

                Text(
                    text = stringResource(R.string.credential_type),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = stringResource(R.string.credential_issuer),
                    style = MaterialTheme.typography.bodyMedium
                )

                if (showLevel) {
                    Text(
                        text = stringResource(R.string.credential_signature_verified),
                        style = MaterialTheme.typography.bodyMedium,
                        color = StatusReconciled,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = stringResource(R.string.claim_verification_level_item),
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }

                if (showIdentity) {
                    Text(
                        text = stringResource(R.string.credential_pseudonym),
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }

                if (showIncome) {
                    val incomeVal = credential.verifiedIncome?.toInt() ?: 0
                    if (incomeVal > 0) {
                        Text(
                            text = stringResource(R.string.verified_income, "₹$incomeVal"),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                if (showReconciliation && credential.verificationLevel == VerificationLevel.FINANCIALLY_CORROBORATED) {
                    Text(
                        text = stringResource(R.string.status_matched_label),
                        style = MaterialTheme.typography.bodyMedium,
                        color = StatusReconciled,
                        fontWeight = FontWeight.Medium
                    )
                }

                if (showOrders) {
                    Text(
                        text = stringResource(R.string.claim_breakdown_unchecked),
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }

                if (showTimestamps) {
                    Text(
                        text = "• Detailed Timestamps Attached",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }

                if (showLocation) {
                    Text(
                        text = "• Location Ledger Attached",
                        style = MaterialTheme.typography.bodySmall,
                        color = TextSecondary
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        val filteredCredential = credential.copy(
            verifiedIncome = if (showIncome) credential.verifiedIncome else null,
            verificationLevel = if (showLevel) credential.verificationLevel else null,
            includedClaims = claimsToDisplay
        )

        Button(
            onClick = {
                if (!isShortening) {
                    isShortening = true
                    coroutineScope.launch {
                        val longLink = generateVerificationLink(filteredCredential)
                        val shortened = shortenUrl(longLink)
                        activeVerificationLink = shortened
                        isShortening = false
                        showShareDialog = true
                    }
                }
            },
            enabled = !isShortening,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            if (isShortening) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(text = stringResource(R.string.shortening_link))
            } else {
                Icon(Icons.Default.Share, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(text = stringResource(R.string.share_with_lender))
            }
        }

        if (showShareDialog) {
            val verificationLink = activeVerificationLink ?: generateVerificationLink(filteredCredential)
            val linkCopiedMsg = stringResource(R.string.link_copied)
            AlertDialog(
                onDismissRequest = { showShareDialog = false },
                title = {
                    Text(
                        text = stringResource(R.string.share_dialog_title),
                        fontWeight = FontWeight.Bold
                    )
                },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(
                            text = stringResource(R.string.share_dialog_instruction),
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Surface(
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            SelectionContainer {
                                Text(
                                    text = verificationLink,
                                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                                    color = Primary,
                                    modifier = Modifier.padding(12.dp)
                                )
                            }
                        }
                        OutlinedButton(
                            onClick = {
                                clipboardManager.setText(AnnotatedString(verificationLink))
                                Toast.makeText(context, linkCopiedMsg, Toast.LENGTH_SHORT).show()
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.ContentCopy,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = stringResource(R.string.copy_link))
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            showShareDialog = false
                            shareCredential(context, verificationLink)
                        },
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(text = stringResource(R.string.continue_to_share))
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showShareDialog = false }) {
                        Text(text = stringResource(R.string.cancel))
                    }
                }
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedButton(
            onClick = onBackToClaims,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.selective_disclosure))
        }
    }
}

@Composable
fun CredentialStatusBadge(text: String, containerColor: Color) {
    Surface(
        color = containerColor.copy(alpha = 0.15f),
        shape = RoundedCornerShape(8.dp)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = containerColor,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

// Previews for all 4 states
@Preview(showBackground = true, name = "CredentialScreen Loading")
@Composable
fun CredentialScreenPreviewLoading() {
    CredentialScreen(uiState = UiState.Loading)
}

@Preview(showBackground = true, name = "CredentialScreen Error")
@Composable
fun CredentialScreenPreviewError() {
    CredentialScreen(uiState = UiState.Error("Could not reach the server, showing saved data instead"))
}

@Preview(showBackground = true, name = "CredentialScreen Empty")
@Composable
fun CredentialScreenPreviewEmpty() {
    CredentialScreen(uiState = UiState.Empty)
}

@Preview(showBackground = true, name = "CredentialScreen Populated")
@Composable
fun CredentialScreenPreviewPopulated() {
    val sampleCredential = Credential(
        workerId = "OS-DEMO-001",
        period = "August 2026",
        verifiedIncome = 30100.0,
        verificationLevel = VerificationLevel.FINANCIALLY_CORROBORATED,
        signaturePreview = "0x7d...a1b",
        includedClaims = listOf("Name", "Verified Income", "Period")
    )
    CredentialScreen(uiState = UiState.Success(sampleCredential))
}
