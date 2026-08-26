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

        // Step 1: package name is the only notification field read before the privacy gate.
        val packageName = sbn.packageName

        scope.launch {
            val preferences = UserPreferencesRepository(applicationContext).userPreferencesFlow.first()
            val allowlist = resolveAllowlist(preferences)

            // Step 2: off-allowlist notifications end here; their content is never read.
            if (packageName !in allowlist) {
                debugLog(packageName, accepted = false)
                return@launch
            }

            // Step 3: an allowlisted notification alone may enter parsing and persistence.
            val boundary = NotificationPrivacyBoundary(
                allowlistProvider = { allowlist },
                parserForAllowedPackage = PlatformRegistry::getParserForAllowedPackage,
                repository = (application as OnShiftApp).evidenceRepository,
                discardLogger = { message -> if (BuildConfig.DEBUG) Log.d("OnShiftNotification", message) }
            )
            val accepted = boundary.handle(packageName, preferences.workerId) {
                val extras = sbn.notification.extras
                NotificationInput(
                    packageName = packageName,
                    title = extras.getString("android.title") ?: "",
                    body = extras.getCharSequence("android.text")?.toString() ?: "",
                    notificationId = "${sbn.id}-${sbn.postTime}"
                )
            }
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
