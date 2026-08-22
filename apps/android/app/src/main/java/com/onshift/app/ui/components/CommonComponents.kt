package com.onshift.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.model.ReconciliationStatus
import com.onshift.app.data.model.VerificationLevel
import com.onshift.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnShiftScaffold(
    title: String,
    step: Int,
    totalSteps: Int = 9,
    showBackButton: Boolean = true,
    onBackClick: () -> Unit = {},
    bottomBar: @Composable () -> Unit = {},
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = OnSurface
                        )
                    },
                    navigationIcon = {
                        if (showBackButton) {
                            IconButton(onClick = onBackClick) {
                                Icon(
                                    imageVector = Icons.Default.ArrowBack,
                                    contentDescription = "Back",
                                    tint = OnSurface
                                )
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Background
                    )
                )
                LinearProgressIndicator(
                    progress = { step.toFloat() / totalSteps.toFloat() },
                    modifier = Modifier.fillMaxWidth(),
                    color = Primary,
                    trackColor = Primary.copy(alpha = 0.2f),
                )
                Text(
                    text = "Step $step of $totalSteps",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }
        },
        bottomBar = bottomBar,
        containerColor = Background,
        content = content
    )
}

@Composable
fun OnShiftCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(containerColor = Surface),
        content = content
    )
}

@Composable
fun Badge(
    text: String,
    backgroundColor: Color,
    textColor: Color = Color.White
) {
    Surface(
        color = backgroundColor,
        shape = RoundedCornerShape(50),
        modifier = Modifier.padding(vertical = 4.dp)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun VerificationLevelBadge(level: VerificationLevel) {
    val (color, textRes) = when (level) {
        VerificationLevel.DECLARED -> LevelDeclared to R.string.level_declared
        VerificationLevel.OBSERVED -> LevelObserved to R.string.level_observed
        VerificationLevel.CORROBORATED -> LevelCorroborated to R.string.level_corroborated
        VerificationLevel.FINANCIALLY_CORROBORATED -> LevelFinCorroborated to R.string.level_financially_corroborated
    }
    Badge(text = stringResource(textRes), backgroundColor = color)
}

@Composable
fun ReconciliationStatusBadge(status: ReconciliationStatus) {
    val (color, textRes) = when (status) {
        ReconciliationStatus.MATCHED -> StatusReconciled to R.string.matched
        ReconciliationStatus.UNEXPLAINED_DIFFERENCE -> StatusUnreconciled to R.string.unexplained_difference
    }
    Badge(text = stringResource(textRes), backgroundColor = color)
}
