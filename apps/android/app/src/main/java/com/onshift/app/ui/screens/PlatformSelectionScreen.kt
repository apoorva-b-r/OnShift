package com.onshift.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.onshift.app.R

@Composable
fun PlatformSelectionScreen(
    onPlatformsSelected: (List<String>) -> Unit
) {
    val platforms = listOf(
        stringResource(R.string.zomato),
        stringResource(R.string.swiggy),
        stringResource(R.string.blinkit)
    )
    var selectedPlatforms by remember { mutableStateOf(setOf<String>()) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        Text(
            text = stringResource(R.string.select_platforms),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.platform_selection_desc),
            style = MaterialTheme.typography.bodyMedium,
            color = com.onshift.app.ui.theme.TextSecondary
        )
        Spacer(modifier = Modifier.height(24.dp))

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(platforms) { platform ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = com.onshift.app.ui.theme.Surface)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 56.dp)
                            .padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = selectedPlatforms.contains(platform),
                            onCheckedChange = { checked ->
                                selectedPlatforms = if (checked) {
                                    selectedPlatforms + platform
                                } else {
                                    selectedPlatforms - platform
                                }
                            }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = platform, style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        Button(
            onClick = { onPlatformsSelected(selectedPlatforms.toList()) },
            modifier = Modifier.fillMaxWidth(),
            enabled = selectedPlatforms.isNotEmpty(),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.continue_btn))
        }
    }
}
