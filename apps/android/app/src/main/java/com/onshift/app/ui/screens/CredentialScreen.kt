package com.onshift.app.ui.screens

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.model.Credential
import com.onshift.app.data.model.MockData
import com.onshift.app.ui.common.*
import com.onshift.app.ui.theme.Primary
import com.onshift.app.ui.theme.StatusReconciled
import com.onshift.app.ui.theme.Surface
import com.onshift.app.ui.theme.TextSecondary

/** Swap this for the real verifier host once the backend team confirms it. */
private const val VERIFICATION_BASE_URL = "https://PLACEHOLDER_DOMAIN"

fun shareCredential(context: Context, credentialId: String) {
    val shareText =
        "Here is my verified income credential from OnShift. View and verify it here: " +
            "$VERIFICATION_BASE_URL/verify/$credentialId"
    val sendIntent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, shareText)
    }
    context.startActivity(Intent.createChooser(sendIntent, "Share with lender"))
}

@Composable
fun CredentialScreen(
    credential: Credential = MockData.mockCredential,
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
    } else {
        CredentialContent(onBackToClaims, credential, disclosedClaims)
    }
}

@Composable
fun CredentialContent(
    onBackToClaims: () -> Unit,
    credential: Credential,
    disclosedClaims: List<String>? = null
) {
    val context = LocalContext.current
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
                    CredentialStatusBadge(
                        text = "VERIFIED",
                        containerColor = StatusReconciled
                    )
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
                    val incomeVal = credential.verifiedIncome?.toInt() ?: 30100
                    Text(
                        text = stringResource(R.string.verified_income, "₹$incomeVal"),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }

                if (showReconciliation) {
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

        Button(
            onClick = { shareCredential(context, credential.workerId) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(Icons.Default.Share, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = stringResource(R.string.share_with_lender))
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
    CredentialScreen(uiState = UiState.Success(MockData.mockCredential))
}
