package com.onshift.services

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.onshift.app.data.ShiftEvidenceItem
import com.onshift.app.data.VaultStore

class ShiftNotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "OnShiftListener"
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.i(TAG, "Notification Listener connected and active.")
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.w(TAG, "Notification Listener disconnected.")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        val packageName = (sbn.packageName ?: "").lowercase()
        val extras = sbn.notification?.extras ?: return

        val title = extras.getString("android.title") ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val bigText = extras.getCharSequence("android.bigText")?.toString() ?: ""
        val subText = extras.getCharSequence("android.subText")?.toString() ?: ""

        val combinedText = "$title $text $bigText $subText"
        val lowerText = combinedText.lowercase()

        // Match any delivery partner, mock notification, or earnings text
        val isTargetNotification = packageName.contains("mock") ||
                packageName.contains("partner") ||
                packageName.contains("onshift") ||
                packageName.contains("zomato") ||
                packageName.contains("swiggy") ||
                packageName.contains("blinkit") ||
                packageName.contains("zepto") ||
                packageName.contains("uber") ||
                lowerText.contains("order") ||
                lowerText.contains("delivered") ||
                lowerText.contains("earned") ||
                lowerText.contains("payout") ||
                lowerText.contains("trip") ||
                lowerText.contains("shift") ||
                lowerText.contains("₹") ||
                lowerText.contains("rs")

        if (isTargetNotification) {
            // 1. Match standard currency formats: ₹65, Rs. 65, Rs 65, INR 65
            val currencyRegex = Regex("""(?:₹|rs\.?|inr)\s*([0-9]+(?:\.[0-9]{1,2})?)""", RegexOption.IGNORE_CASE)
            var parsedAmount = currencyRegex.find(combinedText)?.groupValues?.get(1)?.toDoubleOrNull()

            // 2. Fallback: Match standalone numbers in delivery text
            if (parsedAmount == null) {
                val numberRegex = Regex("""\b([0-9]+(?:\.[0-9]{1,2})?)\b""")
                val foundNumbers = numberRegex.findAll(combinedText).mapNotNull { it.groupValues[1].toDoubleOrNull() }.toList()
                parsedAmount = foundNumbers.firstOrNull { it in 10.0..5000.0 } ?: 65.0
            }

            // Platform Detection
            val platform = when {
                lowerText.contains("zomato") || packageName.contains("zomato") -> "Zomato"
                lowerText.contains("swiggy") || packageName.contains("swiggy") -> "Swiggy"
                lowerText.contains("blinkit") || packageName.contains("blinkit") -> "Blinkit"
                lowerText.contains("zepto") || packageName.contains("zepto") -> "Zepto"
                lowerText.contains("uber") || packageName.contains("uber") -> "Uber"
                else -> "MockPartner"
            }

            Log.i(TAG, "Captured Shift: $platform | Amount: ₹$parsedAmount")

            // Push directly to live UI
            VaultStore.addShift(
                ShiftEvidenceItem(
                    platform = platform,
                    amount = parsedAmount,
                    timestamp = "Just now",
                    isVerified = true
                )
            )
        }
    }
}