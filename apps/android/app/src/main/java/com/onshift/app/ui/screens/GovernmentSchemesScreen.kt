package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.model.MockData
import com.onshift.app.data.model.SchemeMatch
import com.onshift.app.ui.common.*
import com.onshift.app.ui.theme.TextSecondary

@Composable
fun GovernmentSchemesScreen(
    schemeMatches: List<SchemeMatch> = MockData.mockSchemeMatches,
    onRestartDemo: () -> Unit = {},
    uiState: UiState<List<SchemeMatch>>? = null
) {
    if (uiState != null) {
        when (uiState) {
            is UiState.Loading -> UiStateLoadingView()
            is UiState.Error -> UiStateErrorView(message = uiState.message)
            is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.no_matching_schemes))
            is UiState.Success -> GovernmentSchemesContent(schemeMatches = uiState.data)
        }
    } else {
        GovernmentSchemesContent(schemeMatches = schemeMatches)
    }
}

@Composable
fun GovernmentSchemesContent(
    schemeMatches: List<SchemeMatch>
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        Text(
            text = stringResource(R.string.eligible_schemes),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(16.dp))

        if (schemeMatches.isEmpty()) {
            UiStateEmptyView(message = stringResource(R.string.no_matching_schemes))
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(schemeMatches) { scheme ->
                    SchemeCard(scheme)
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
fun SchemeCard(scheme: SchemeMatch) {
    Card(
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(scheme.schemeNameRes),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = stringResource(scheme.descriptionRes),
                style = MaterialTheme.typography.bodyMedium
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = { /* Apply logic */ },
                enabled = scheme.eligible
            ) {
                Text(text = stringResource(R.string.apply_now))
            }
        }
    }
}

// Previews for all 4 states
@Preview(showBackground = true, name = "GovernmentSchemes Loading")
@Composable
fun GovernmentSchemesPreviewLoading() {
    GovernmentSchemesScreen(uiState = UiState.Loading)
}

@Preview(showBackground = true, name = "GovernmentSchemes Error")
@Composable
fun GovernmentSchemesPreviewError() {
    GovernmentSchemesScreen(uiState = UiState.Error("Could not reach the server, showing saved data instead"))
}

@Preview(showBackground = true, name = "GovernmentSchemes Empty")
@Composable
fun GovernmentSchemesPreviewEmpty() {
    GovernmentSchemesScreen(uiState = UiState.Empty)
}

@Preview(showBackground = true, name = "GovernmentSchemes Populated")
@Composable
fun GovernmentSchemesPreviewPopulated() {
    GovernmentSchemesScreen(uiState = UiState.Success(MockData.mockSchemeMatches))
}
