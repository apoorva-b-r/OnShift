package com.onshift.app.ui.screens

import android.content.Intent
import android.net.Uri
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.model.LiveSchemeRecommendation
import com.onshift.app.data.model.MockData
import com.onshift.app.data.model.SchemeMatch
import com.onshift.app.ui.common.*
import com.onshift.app.ui.theme.*
import com.onshift.app.ui.viewmodel.GovernmentSchemesViewModel

@Composable
fun GovernmentSchemesScreen(
    viewModel: GovernmentSchemesViewModel? = null,
    schemeMatches: List<SchemeMatch> = MockData.mockSchemeMatches,
    onRestartDemo: () -> Unit = {},
    uiState: UiState<List<SchemeMatch>>? = null
) {
    if (viewModel != null) {
        val vmState by viewModel.uiState.collectAsState()
        val streamingReasons by viewModel.streamingReasons.collectAsState()
        val engineSource by viewModel.engineSource.collectAsState()

        when (val state = vmState) {
            is UiState.Loading -> UiStateLoadingView(message = stringResource(R.string.consulting_ai_engine))
            is UiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        UiStateErrorView(message = state.message)
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { viewModel.fetchRecommendations() },
                            colors = ButtonDefaults.buttonColors(containerColor = Primary)
                        ) {
                            Text(text = stringResource(R.string.retry), fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
            is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.no_matching_schemes))
            is UiState.Success -> LiveGovernmentSchemesContent(
                recommendations = state.data,
                streamingReasons = streamingReasons,
                engineSource = engineSource
            )
        }
    } else if (uiState != null) {
        when (uiState) {
            is UiState.Loading -> UiStateLoadingView(message = stringResource(R.string.consulting_ai_engine))
            is UiState.Error -> UiStateErrorView(message = uiState.message)
            is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.no_matching_schemes))
            is UiState.Success -> GovernmentSchemesContent(schemeMatches = uiState.data)
        }
    } else {
        GovernmentSchemesContent(schemeMatches = schemeMatches)
    }
}

@Composable
fun LiveGovernmentSchemesContent(
    recommendations: List<LiveSchemeRecommendation>,
    streamingReasons: Map<String, String>,
    engineSource: String
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        Text(
            text = stringResource(R.string.eligible_schemes),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = OnSurface
        )
        Spacer(modifier = Modifier.height(16.dp))

        if (recommendations.isEmpty()) {
            UiStateEmptyView(message = stringResource(R.string.no_matching_schemes))
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(recommendations, key = { it.schemeId }) { scheme ->
                    LiveSchemeCard(
                        scheme = scheme,
                        streamingReason = streamingReasons[scheme.schemeId],
                        engineSource = engineSource
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
fun LiveSchemeCard(
    scheme: LiveSchemeRecommendation,
    streamingReason: String?,
    engineSource: String
) {
    val context = LocalContext.current

    val (badgeBgColor, badgeTextColor) = when (scheme.relevance.uppercase()) {
        "HIGH" -> StatusReconciled to Color.White
        "MEDIUM" -> StatusUnreconciled to Color.White
        else -> LevelDeclared to Color.White
    }

    val displayMatchReason = if (!streamingReason.isNullOrEmpty()) {
        "$streamingReason ▌"
    } else {
        scheme.matchReason
    }

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
            // Header Row: Scheme Name & Relevance Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = scheme.schemeName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = OnSurface,
                    modifier = Modifier.weight(1f)
                )

                Spacer(modifier = Modifier.width(8.dp))

                Surface(
                    color = badgeBgColor,
                    shape = RoundedCornerShape(50)
                ) {
                    Text(
                        text = scheme.relevance.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = badgeTextColor,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }

            // Description
            if (scheme.description.isNotEmpty()) {
                Text(
                    text = scheme.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            }

            Divider(color = MaterialTheme.colorScheme.surfaceVariant)

            // Streamed or Final Match Reason
            if (displayMatchReason.isNotEmpty()) {
                Text(
                    text = displayMatchReason,
                    style = MaterialTheme.typography.bodyMedium,
                    color = OnSurface
                )
            }

            // Benefits List
            if (scheme.benefits.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    scheme.benefits.forEach { benefit ->
                        Text(
                            text = "• $benefit",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Bottom Row: Engine Source Chip & Apply Now Button
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val chipText = if (scheme.explanationSource.equals("NEMOTRON_ULTRA_3", ignoreCase = true) ||
                    engineSource.equals("NEMOTRON_ULTRA_3", ignoreCase = true)
                ) {
                    stringResource(R.string.engine_source_nemotron)
                } else {
                    stringResource(R.string.engine_source_deterministic)
                }

                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = chipText,
                        style = MaterialTheme.typography.labelSmall,
                        color = TextSecondary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }

                OutlinedButton(
                    onClick = {
                        if (scheme.applicationUrl.isNotEmpty()) {
                            try {
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(scheme.applicationUrl))
                                context.startActivity(intent)
                            } catch (_: Exception) {}
                        }
                    },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(text = stringResource(R.string.apply_now), fontWeight = FontWeight.Bold)
                }
            }
        }
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
            fontWeight = FontWeight.Bold,
            color = OnSurface
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
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(scheme.schemeNameRes),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = OnSurface
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = stringResource(scheme.descriptionRes),
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(16.dp))
            OutlinedButton(
                onClick = { /* Apply logic */ },
                enabled = scheme.eligible,
                shape = RoundedCornerShape(12.dp)
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
