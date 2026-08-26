package com.onshift.app.notifications

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.onshift.app.BuildConfig
import com.onshift.app.OnShiftApp
import com.onshift.app.data.UserPreferencesRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.first

class OnShiftNotificationListenerService : NotificationListenerService() {

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val packageName = sbn.packageName
        val extras = sbn.notification.extras
        val title = extras.getString("android.title") ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val notificationId = "${sbn.id}-${sbn.postTime}"

        scope.launch {
            val preferences = UserPreferencesRepository(applicationContext).userPreferencesFlow.first()
            if (packageName !in PlatformRegistry.allowedPackages(preferences.selectedPlatforms)) {
                debugLog(packageName, accepted = false)
                return@launch
            }

            val ingestion = NotificationEvidenceIngestion((application as OnShiftApp).evidenceRepository)
            val accepted = ingestion.ingest(
                NotificationInput(packageName, title, text, notificationId),
                preferences.workerId
            )
            debugLog(packageName, accepted)
        }
    }

    private fun debugLog(packageName: String, accepted: Boolean) {
        if (BuildConfig.DEBUG) {
            // Do not log raw notification text or amounts. The encrypted vault is the only raw-data store.
            Log.d("OnShiftNotification", "package=$packageName status=${if (accepted) "accepted" else "discarded"}")
        }
    }
}
