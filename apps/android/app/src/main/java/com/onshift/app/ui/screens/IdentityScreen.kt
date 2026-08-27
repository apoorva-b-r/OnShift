package com.onshift.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onshift.app.R
import com.onshift.app.data.api.BackendApiClient
import com.onshift.app.data.api.InitiateDigiLockerResponse
import com.onshift.app.data.api.VerifyDigiLockerResponse
import com.onshift.app.ui.theme.*

sealed interface VerificationState {
    object Initial : VerificationState
    object Loading : VerificationState
    data class PendingAuth(val authorizationUrl: String, val requestId: String) : VerificationState
    object Success : VerificationState
    data class Error(val message: String) : VerificationState
}

@Composable
fun IdentityScreen(
    isOnboarding: Boolean = false,
    isIdentityVerified: Boolean = false,
    workerId: String = "OS-DEMO-001",
    workerName: String = "Vikram Malhotra",
    onVerifySuccess: () -> Unit = {},
    onSkip: () -> Unit = {},
    onCompleteOnboarding: () -> Unit = {}
) {
    val context = LocalContext.current

    var state by remember(isIdentityVerified) {
        mutableStateOf<VerificationState>(
            if (isIdentityVerified) VerificationState.Success else VerificationState.Initial
        )
    }

    fun openBrowser(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            context.startActivity(intent)
        } catch (e: Exception) {
            state = VerificationState.Error("Could not open browser: ${e.message}")
        }
    }

    val completeVerification: () -> Unit = {
        state = VerificationState.Loading
        BackendApiClient.verifyDigiLocker(object : BackendApiClient.ApiCallback<VerifyDigiLockerResponse> {
            override fun onSuccess(verifyRes: VerifyDigiLockerResponse) {
                if (verifyRes.identityVerified || verifyRes.status == "VERIFIED") {
                    state = VerificationState.Success
                    onVerifySuccess()
                } else {
                    state = VerificationState.Error("DigiLocker verification status: ${verifyRes.status}")
                }
            }

            override fun onError(error: String) {
                state = VerificationState.Error(error)
            }
        })
    }

    val startVerification: () -> Unit = {
        state = VerificationState.Loading
        BackendApiClient.initiateDigiLocker(object : BackendApiClient.ApiCallback<InitiateDigiLockerResponse> {
            override fun onSuccess(initRes: InitiateDigiLockerResponse) {
                val url = initRes.authorizationUrl
                val reqId = initRes.requestId
                if (!url.isNullOrBlank()) {
                    openBrowser(url)
                    state = VerificationState.PendingAuth(authorizationUrl = url, requestId = reqId)
                } else {
                    state = VerificationState.Error("Setu authorization URL was empty")
                }
            }

            override fun onError(error: String) {
                state = VerificationState.Error(error)
            }
        })
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

        when (val currentState = state) {
            VerificationState.Initial -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Button(
                            onClick = startVerification,
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

                        TextButton(
                            onClick = onSkip,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Skip for now",
                                style = MaterialTheme.typography.bodyLarge,
                                color = TextSecondary,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }

            is VerificationState.PendingAuth -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = "DigiLocker Authorization Opened",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Primary,
                            textAlign = TextAlign.Center
                        )

                        Text(
                            text = "Please complete authorization in your browser window, then tap below to finish verification.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )

                        Button(
                            onClick = completeVerification,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Primary,
                                contentColor = OnSurface
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Complete & Verify Identity",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }

                        OutlinedButton(
                            onClick = { openBrowser(currentState.authorizationUrl) },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Re-open Authorization Page",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp
                            )
                        }

                        TextButton(
                            onClick = onSkip,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Skip for now",
                                style = MaterialTheme.typography.bodyLarge,
                                color = TextSecondary,
                                fontWeight = FontWeight.Medium
                            )
                        }
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

            is VerificationState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Warning,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.error,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = currentState.message,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = startVerification,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Primary,
                                contentColor = OnSurface
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Retry Verification",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        TextButton(
                            onClick = onSkip,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Skip for now",
                                style = MaterialTheme.typography.bodyLarge,
                                color = TextSecondary,
                                fontWeight = FontWeight.Medium
                            )
                        }
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
                                text = stringResource(R.string.pseudonym_id, workerId),
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Primary
                            )
                            Divider(modifier = Modifier.padding(vertical = 4.dp))
                            Text(
                                text = stringResource(R.string.worker_name, workerName),
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


