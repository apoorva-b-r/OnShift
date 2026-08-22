package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onshift.app.R
import com.onshift.app.ui.theme.*
import kotlinx.coroutines.delay

sealed interface VerificationState {
    object Initial : VerificationState
    object Loading : VerificationState
    object Success : VerificationState
}

@Composable
fun IdentityScreen(
    isOnboarding: Boolean = false,
    onCompleteOnboarding: () -> Unit = {}
) {
    var state by remember { mutableStateOf<VerificationState>(VerificationState.Initial) }

    if (state is VerificationState.Loading) {
        LaunchedEffect(Unit) {
            delay(2000L)
            state = VerificationState.Success
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // App Branding & Title Section
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = stringResource(R.string.app_name),
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = Primary
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = stringResource(R.string.identity_verification),
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = OnSurface
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.aadhaar_desc),
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(32.dp))

        when (state) {
            VerificationState.Initial -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Button(
                        onClick = {
                            state = VerificationState.Loading
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Primary,
                            contentColor = OnSurface
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = stringResource(R.string.verify_with_digilocker),
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            modifier = Modifier.padding(vertical = 4.dp)
                        )
                    }
                }
            }

            VerificationState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(
                            color = Primary,
                            strokeWidth = 3.dp,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = stringResource(R.string.verifying_digilocker),
                            style = MaterialTheme.typography.bodyLarge,
                            color = TextSecondary,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            VerificationState.Success -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CheckCircle,
                            contentDescription = null,
                            tint = StatusReconciled,
                            modifier = Modifier.size(28.dp)
                        )
                        Text(
                            text = stringResource(R.string.identity_verified),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                            color = StatusReconciled
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Card(
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.pseudonym_id, "OS-82F91A"),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Primary
                            )
                            Divider(modifier = Modifier.padding(vertical = 4.dp))
                            Text(
                                text = stringResource(R.string.worker_name, "Ravi Kumar"),
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.Medium,
                                color = OnSurface
                            )
                            Text(
                                text = stringResource(R.string.primary_role),
                                style = MaterialTheme.typography.bodyMedium,
                                color = TextSecondary
                            )
                            Text(
                                text = stringResource(R.string.vault_status_active),
                                style = MaterialTheme.typography.bodySmall,
                                color = StatusReconciled,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.weight(1f))

                    if (isOnboarding) {
                        Button(
                            onClick = onCompleteOnboarding,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Primary,
                                contentColor = OnSurface
                            ),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.continue_btn),
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
