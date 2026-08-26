package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.onshift.app.ui.theme.Primary
import com.onshift.app.ui.theme.TextSecondary
import com.onshift.app.utils.PasswordHasher

@Composable
fun SignInScreen(
    initialEmail: String = "",
    storedEmail: String = "",
    storedPasswordHash: String = "",
    onSignInSuccess: (emailOrId: String, password: String) -> Unit,
    onNavigateToSignUp: () -> Unit
) {
    var emailOrId by remember { mutableStateOf(if (initialEmail.isNotBlank()) initialEmail else "vikram.malhotra@example.com") }
    var password by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(32.dp))

        Text(
            text = "Worker Sign In",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = Primary
        )

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "Welcome back! Enter your login details to continue.",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary
        )

        Spacer(modifier = Modifier.height(32.dp))

        if (errorMessage != null) {
            Text(
                text = errorMessage!!,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }

        OutlinedTextField(
            value = emailOrId,
            onValueChange = { emailOrId = it },
            label = { Text("Email Address or Worker ID") },
            placeholder = { Text("worker@example.com") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            placeholder = { Text("••••••••") },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = {
                val enteredHash = PasswordHasher.hashPassword(password)
                val isEmailValid = emailOrId.isNotBlank()
                val isPasswordCorrect = if (storedPasswordHash.isNotEmpty()) {
                    enteredHash == storedPasswordHash
                } else {
                    password.isNotBlank()
                }

                if (!isEmailValid || !isPasswordCorrect) {
                    errorMessage = "Incorrect email or password"
                } else {
                    errorMessage = null
                    onSignInSuccess(emailOrId.trim(), password)
                }
            },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
        ) {
            Text("Sign In to Account", fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }

        Spacer(modifier = Modifier.height(24.dp))

        TextButton(onClick = onNavigateToSignUp) {
            Text("Don't have an account? Sign Up", color = Primary)
        }
    }
}
