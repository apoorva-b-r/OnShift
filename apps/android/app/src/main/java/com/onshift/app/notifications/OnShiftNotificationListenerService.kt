package com.onshift.app.notifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

class OnShiftNotificationListenerService : NotificationListenerService() {

    private val parsers: List<NotificationParser> = listOf(
        ZomatoParser(),
        SwiggyParser(),
        UberParser(),
        GenericParser()
    )

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        sbn ?: return

        val packageName = sbn.packageName ?: return
        val extras = sbn.notification?.extras ?: return
        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val fullText = "$title $text"

        for (parser in parsers) {
            if (parser.canParse(packageName, fullText)) {
                val parsed = parser.parse(packageName, fullText)
                if (parsed != null) {
                    Log.d("OnShiftNotif", "Captured evidence from ${parsed.platform}: INR ${parsed.amount}")
                    // Store into LocalEncryptedEvidenceRepository and update HashChain
                }
                break
            }
        }
    }
}
