package com.onshift.app.notifications

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat

object NotificationPermissionHelper {

    const val MOCK_PARTNER_PACKAGE = "com.onshift.mockpartner"

    /**
     * Checks whether the Mock Partner app is installed on the user's phone.
     */
    fun isMockPartnerInstalled(context: Context): Boolean {
        return isPackageInstalled(context, MOCK_PARTNER_PACKAGE)
    }

    /**
     * Checks whether any gig partner app is installed (Mock Partner, Swiggy, Zomato, Uber).
     */
    fun isAnyPartnerAppInstalled(context: Context): Boolean {
        val partnerPackages = listOf(
            MOCK_PARTNER_PACKAGE,
            "in.swiggy.android",
            "com.application.zomato",
            "in.swiggy.deliveryapp",
            "com.ubercab.driver"
        )
        return partnerPackages.any { isPackageInstalled(context, it) }
    }

    fun isPackageInstalled(context: Context, packageName: String): Boolean {
        return try {
            context.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (_: PackageManager.NameNotFoundException) {
            false
        }
    }

    /**
     * Checks whether Notification Listener Service access is granted to OnShift.
     */
    fun isNotificationListenerGranted(context: Context): Boolean {
        return try {
            val enabledListeners = NotificationManagerCompat.getEnabledListenerPackages(context)
            enabledListeners.contains(context.packageName)
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Opens Android System Settings directly to Notification Listener Access page.
     */
    fun openNotificationListenerSettings(context: Context) {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        try {
            context.startActivity(intent)
        } catch (_: Exception) {
            try {
                val appSettingsIntent = Intent(Settings.ACTION_SETTINGS).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(appSettingsIntent)
            } catch (_: Exception) {}
        }
    }

    /**
     * Opens notification settings for the Mock Partner app directly.
     */
    fun openMockPartnerNotificationSettings(context: Context) {
        try {
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, MOCK_PARTNER_PACKAGE)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (_: Exception) {
            try {
                val appDetailIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:$MOCK_PARTNER_PACKAGE")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(appDetailIntent)
            } catch (_: Exception) {}
        }
    }
}
