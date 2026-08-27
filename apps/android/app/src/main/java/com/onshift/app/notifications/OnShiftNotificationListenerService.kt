package com.onshift.app.notifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class OnShiftNotificationListenerService : NotificationListenerService() {

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val packageName = sbn.packageName ?: ""
        val extras = sbn.notification.extras
        val title = extras.getString("android.title") ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val notificationId = "${sbn.id}-${sbn.postTime}"

        val content = "$title $text"
        val parser = PlatformRegistry.getParserForPackage(packageName, content)

        scope.launch {
            val evidence = parser.parse(
                title = title,
                body = text,
                notificationId = notificationId,
                workerId = "OS-DEMO-001"
            )

            if (evidence != null) {
                Log.d("OnShiftNotification", "Successfully parsed notification evidence: ${evidence.platform} ₹${evidence.amount}")
                try {
                    val repo = com.onshift.app.data.vault.LocalEncryptedEvidenceRepository.createInstance(applicationContext)
                    repo.createAndSaveEvidence(
                        workerId = evidence.workerId,
                        source = evidence.source,
                        platform = evidence.platform,
                        eventType = evidence.type,
                        type = evidence.type,
                        amount = evidence.amount,
                        reference = evidence.reference,
                        rawMetadata = "{\"title\":\"${title.replace("\"", "\\\"")}\",\"body\":\"${text.replace("\"", "\\\"")}\"}"
                    )
                } catch (e: Exception) {
                    Log.e("OnShiftNotification", "Error saving parsed evidence", e)
                }
            }
        }
    }
}