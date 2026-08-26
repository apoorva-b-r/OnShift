package com.onshift.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onshift.app.ui.theme.Primary
import com.onshift.app.ui.theme.Surface
import com.onshift.app.ui.theme.TextSecondary

@Composable
fun PhoneOtpScreen(
    phoneNumber: String = "+91 98765 43210",
    onVerify: (otp: String) -> Unit = {},
    onResend: () -> Unit = {},
    isVerifying: Boolean = false,
    errorMessage: String? = null
) {
    var otpText by remember { mutableStateOf("") }
    val focusRequester = remember { FocusRequester() }
    val scrollState = rememberScrollState()

    // Request focus on OTP field when screen opens
    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(32.dp))

        // Shield / Security Badge Icon
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Primary.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = "Phone Verification",
                tint = Primary,
                modifier = Modifier.size(32.dp)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Verify your phone number",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "We've sent a 6-digit verification code to",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = phoneNumber,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Primary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Demo OTP Hint Card
        Card(
            colors = CardDefaults.cardColors(
                containerColor = Primary.copy(alpha = 0.08f)
            ),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Info,
                    contentDescription = "Demo Mode",
                    tint = Primary,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Demo Mode: Use OTP ",
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
                Text(
                    text = "123456",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Bold,
                    color = Primary
                )
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        // 6-digit OTP Box Input Layout
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { focusRequester.requestFocus() },
            contentAlignment = Alignment.Center
        ) {
            // Invisible BasicTextField for numeric keyboard input, pasting, & focus management
            BasicTextField(
                value = otpText,
                onValueChange = { newValue ->
                    val filtered = newValue.filter { it.isDigit() }.take(6)
                    otpText = filtered
                },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier
                    .focusRequester(focusRequester)
                    .size(1.dp), // Tiny invisible field overlay
                singleLine = true
            )

            // Visible 6 Digit Boxes
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                modifier = Modifier.fillMaxWidth()
            ) {
                for (i in 0 until 6) {
                    val digit = otpText.getOrNull(i)?.toString() ?: ""
                    val isFocused = otpText.length == i || (otpText.length == 6 && i == 5)
                    val boxBorderColor = when {
                        errorMessage != null -> MaterialTheme.colorScheme.error
                        isFocused -> Primary
                        digit.isNotEmpty() -> Primary.copy(alpha = 0.5f)
                        else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(56.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Surface)
                            .border(
                                width = if (isFocused) 2.dp else 1.dp,
                                color = boxBorderColor,
                                shape = RoundedCornerShape(12.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = digit,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Error Message Banner
        if (errorMessage != null) {
            Text(
                text = errorMessage,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Medium,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 8.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Primary Verification Button
        Button(
            onClick = {
                if (otpText.length == 6 && !isVerifying) {
                    onVerify(otpText)
                }
            },
            enabled = otpText.length == 6 && !isVerifying,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            if (isVerifying) {
                CircularProgressIndicator(
                    modifier = Modifier.size(22.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    strokeWidth = 2.5.dp
                )
            } else {
                Text(
                    text = "Verify",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Resend Code Button
        TextButton(
            onClick = onResend,
            enabled = !isVerifying
        ) {
            Text(
                text = "Resend code",
                color = Primary,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}
