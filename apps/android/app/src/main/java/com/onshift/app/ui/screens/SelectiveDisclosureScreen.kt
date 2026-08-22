package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.ui.common.*

@Composable
fun SelectiveDisclosureScreen(
    onGenerateCredential: () -> Unit = {},
    onClaimsSelected: ((List<String>) -> Unit)? = null,
    uiState: UiState<Unit>? = null
) {
    if (uiState != null) {
        when (uiState) {
            is UiState.Loading -> UiStateLoadingView()
            is UiState.Error -> UiStateErrorView(message = uiState.message)
            is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.empty_credential))
            is UiState.Success -> SelectiveDisclosureContent(onGenerateCredential, onClaimsSelected)
        }
    } else {
        SelectiveDisclosureContent(onGenerateCredential, onClaimsSelected)
    }
}

@Composable
fun SelectiveDisclosureContent(
    onGenerateCredential: () -> Unit,
    onClaimsSelected: ((List<String>) -> Unit)? = null
) {
    var claimIdentity by remember { mutableStateOf(true) }
    var claimIncome by remember { mutableStateOf(true) }
    var claimLevel by remember { mutableStateOf(true) }
    var claimReconciliation by remember { mutableStateOf(true) }
    var claimOrders by remember { mutableStateOf(false) }
    var claimTimestamps by remember { mutableStateOf(false) }
    var claimLocation by remember { mutableStateOf(false) }

    val activeClaims by remember(
        claimIdentity,
        claimIncome,
        claimLevel,
        claimReconciliation,
        claimOrders,
        claimTimestamps,
        claimLocation
    ) {
        derivedStateOf {
            buildList {
                if (claimIdentity) add("Identity Verified")
                if (claimIncome) add("Verified Income: ₹30,100")
                if (claimLevel) add("Verification Level: FINANCIALLY CORROBORATED")
                if (claimReconciliation) add("Reconciliation Status: MATCHED")
                if (claimOrders) add("Individual Orders Breakdown")
                if (claimTimestamps) add("Detailed Timestamps")
                if (claimLocation) add("Location Ledger")
            }
        }
    }

    LaunchedEffect(activeClaims) {
        onClaimsSelected?.invoke(activeClaims)
    }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp)
    ) {
        Text(
            text = stringResource(R.string.selective_disclosure),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = stringResource(R.string.disclosure_desc),
            style = MaterialTheme.typography.bodyMedium,
            color = com.onshift.app.ui.theme.TextSecondary
        )
        Spacer(modifier = Modifier.height(20.dp))

        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = com.onshift.app.ui.theme.Surface)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ClaimCheckboxItem(
                    label = stringResource(R.string.claim_identity_verified),
                    checked = claimIdentity,
                    onCheckedChange = { claimIdentity = it }
                )
                ClaimCheckboxItem(
                    label = stringResource(R.string.claim_verified_income),
                    checked = claimIncome,
                    onCheckedChange = { claimIncome = it }
                )
                ClaimCheckboxItem(
                    label = stringResource(R.string.claim_verification_level),
                    checked = claimLevel,
                    onCheckedChange = { claimLevel = it }
                )
                ClaimCheckboxItem(
                    label = stringResource(R.string.claim_reconciliation_status),
                    checked = claimReconciliation,
                    onCheckedChange = { claimReconciliation = it }
                )
                Divider(modifier = Modifier.padding(vertical = 4.dp))
                ClaimCheckboxItem(
                    label = stringResource(R.string.claim_individual_orders),
                    checked = claimOrders,
                    onCheckedChange = { claimOrders = it }
                )
                ClaimCheckboxItem(
                    label = stringResource(R.string.claim_timestamps),
                    checked = claimTimestamps,
                    onCheckedChange = { claimTimestamps = it }
                )
                ClaimCheckboxItem(
                    label = stringResource(R.string.claim_location),
                    checked = claimLocation,
                    onCheckedChange = { claimLocation = it }
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onGenerateCredential,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.generate_credential))
        }
    }
}

@Composable
fun ClaimCheckboxItem(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = checked,
            onCheckedChange = onCheckedChange
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(text = label, style = MaterialTheme.typography.bodyLarge)
    }
}

// Previews for all 4 states
@Preview(showBackground = true, name = "SelectiveDisclosure Loading")
@Composable
fun SelectiveDisclosurePreviewLoading() {
    SelectiveDisclosureScreen(uiState = UiState.Loading)
}

@Preview(showBackground = true, name = "SelectiveDisclosure Error")
@Composable
fun SelectiveDisclosurePreviewError() {
    SelectiveDisclosureScreen(uiState = UiState.Error("Could not reach the server, showing saved data instead"))
}

@Preview(showBackground = true, name = "SelectiveDisclosure Empty")
@Composable
fun SelectiveDisclosurePreviewEmpty() {
    SelectiveDisclosureScreen(uiState = UiState.Empty)
}

@Preview(showBackground = true, name = "SelectiveDisclosure Populated")
@Composable
fun SelectiveDisclosurePreviewPopulated() {
    SelectiveDisclosureScreen(uiState = UiState.Success(Unit))
}
