package com.onshift.app.notifications

import android.content.Context
import androidx.compose.runtime.DisposableEffect
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver

@Composable
fun NotificationAccessOnboardingScreen(
    selectedPlatforms: List<String>,
    onContinue: () -> Unit
) {
    val context = LocalContext.current
    val declaredPlatforms = selectedPlatforms
    Column(
        modifier = Modifier.padding(20.dp),
        verticalArrangement = Arrangement.Center
    ) {
        // TODO: move this copy to translated string resources under the multilingual plan.
        Text("Connect work notifications", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text(
            "OnShift will read notifications only from ${declaredPlatforms.joinToString().ifBlank { "your selected work platforms" }}. It will not read notifications from any other app.",
            style = MaterialTheme.typography.bodyLarge
        )
        Spacer(Modifier.height(24.dp))
        Button(
            onClick = { context.startActivity(notificationListenerSettingsIntent()) },
            modifier = Modifier.fillMaxWidth()
        ) { Text("Enable notification access") }
        Spacer(Modifier.height(8.dp))
        OutlinedButton(onClick = onContinue, modifier = Modifier.fillMaxWidth()) {
            Text("Continue")
        }
    }
}

/** A non-dismissible dashboard warning. Recomposition rechecks access whenever Home is loaded. */
@Composable
fun NotificationAccessBanner(
    selectedPlatforms: List<String>,
    context: Context = LocalContext.current
) {
    var enabled by remember { mutableStateOf(isNotificationServiceEnabled(context)) }
    val lifecycleOwner = LocalLifecycleOwner.current
    LaunchedEffect(Unit) { enabled = isNotificationServiceEnabled(context) }
    DisposableEffect(lifecycleOwner, context) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                enabled = isNotificationServiceEnabled(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }
    if (!enabled && selectedPlatforms.isNotEmpty()) {
        Card(modifier = Modifier.fillMaxWidth(), colors = androidx.compose.material3.CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        )) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // TODO: move this copy to translated string resources under the multilingual plan.
                Text("Notification access needs attention", fontWeight = FontWeight.Bold)
                Text("Notification access is off. Some phones can revoke it during battery management.")
                Button(onClick = { context.startActivity(notificationListenerSettingsIntent()) }) {
                    Text("Re-enable access")
                }
            }
        }
    }
}
