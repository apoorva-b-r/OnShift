package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onshift.app.data.model.VerificationResult
import com.onshift.app.ui.components.OnShiftCard
import com.onshift.app.ui.components.OnShiftScaffold
import com.onshift.app.ui.components.VerificationLevelBadge
import com.onshift.app.ui.theme.Primary
import com.onshift.app.ui.theme.TextSecondary

@Composable
fun VerificationScreen(
    verificationResult: VerificationResult,
    onNext: () -> Unit,
    onBack: () -> Unit
) {
    OnShiftScaffold(
        title = "Verification",
        step = 5,
        onBackClick = onBack,
        bottomBar = {
            Button(
                onClick = onNext,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) {
                Text("Next")
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "Verification Result",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            
            OnShiftCard {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Primary, modifier = Modifier.size(24.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Status: Verified", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(text = "Confidence Score", style = MaterialTheme.typography.titleMedium, color = TextSecondary)
                    Text(text = "${(verificationResult.confidenceScore * 100).toInt()}%", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(16.dp))
                    VerificationLevelBadge(level = verificationResult.level)
                }
            }
            
            OnShiftCard {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Explanation", style = MaterialTheme.typography.titleMedium, color = TextSecondary)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = verificationResult.explanation, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}
