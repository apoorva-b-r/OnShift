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
                Log.d("OnShiftNotification", "Parsed Evidence: ${evidence.toJson()}")
            }
        }
    }
}