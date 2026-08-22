package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.onshift.app.R

@Composable
fun PrivacyScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(text = stringResource(R.string.privacy_layer_control), style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(12.dp))
        Text(text = stringResource(R.string.privacy_item_1))
        Text(text = stringResource(R.string.privacy_item_2))
        Text(text = stringResource(R.string.privacy_item_3))
        Text(text = stringResource(R.string.privacy_item_4))
    }
}
