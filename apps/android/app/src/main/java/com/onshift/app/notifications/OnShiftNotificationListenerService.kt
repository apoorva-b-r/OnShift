package com.onshift.app.notifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.onshift.app.data.vault.LocalEncryptedEvidenceRepository
import java.time.Instant

class OnShiftNotificationListenerService : NotificationListenerService() {

    private val repository = LocalEncryptedEvidenceRepository.instance

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)

        if (sbn == null) return

        val packageName = sbn.packageName ?: return
        val extras = sbn.notification.extras
        val title = extras.getString("android.title")
        val text = extras.getCharSequence("android.text")?.toString()

        // 1. Convert Android Framework notification to pure RawNotification model
        val rawNotification = RawNotification(
            packageName = packageName,
            title = title,
            text = text,
            timestamp = Instant.ofEpochMilli(sbn.postTime),
            notificationId = sbn.id.toString()
        )

        // 2. Delegate extraction to PlatformRegistry
        val parseResult = PlatformRegistry.parse(rawNotification)

        if (parseResult.success && parseResult.evidence != null) {
            val evidence = parseResult.evidence
            Log.d("OnShiftListener", "Parsed Evidence: Platform=${evidence.platform}, Amount=${evidence.amount}, Confidence=${evidence.extractionConfidence}")

            // 3. Save into local tamper-evident vault if an amount was parsed
            evidence.amount?.let { extractedAmount ->
                repository.createAndSaveEvidence(
                    platform = evidence.platform.name,
                    amount = extractedAmount
                )
            }
        } else {
            Log.d("OnShiftListener", "Notification ignored or unparsed from $packageName: Warnings=${parseResult.warnings}")
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        super.onNotificationRemoved(sbn)
    }
}