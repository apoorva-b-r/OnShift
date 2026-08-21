package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.onshift.app.R

@Composable
fun LanguageSelectionScreen(
    onLanguageSelected: (String) -> Unit
) {
    val scrollState = rememberScrollState()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = stringResource(R.string.select_language),
            style = MaterialTheme.typography.headlineSmall
        )
        Spacer(modifier = Modifier.height(32.dp))
        Button(
            onClick = { onLanguageSelected("en") },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(text = stringResource(R.string.english))
        }
        Spacer(modifier = Modifier.height(16.dp))
        Button(
            onClick = { onLanguageSelected("hi") },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(text = stringResource(R.string.hindi))
        }
    }
}
