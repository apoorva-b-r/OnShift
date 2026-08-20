package com.onshift.app.notifications

class UberParser : NotificationParser {
    override fun canParse(packageName: String, text: String): Boolean {
        return packageName.contains("uber", ignoreCase = true) || text.contains("Uber", ignoreCase = true)
    }

    override fun parse(packageName: String, text: String): ParsedNotificationEvidence? {
        if (!canParse(packageName, text)) return null
        return ParsedNotificationEvidence(
            platform = "Uber",
            amount = 15000.0,
            reference = "UBER-NOTIF-" + System.currentTimeMillis().toString().takeLast(6),
            rawSnippet = text
        )
    }
}
