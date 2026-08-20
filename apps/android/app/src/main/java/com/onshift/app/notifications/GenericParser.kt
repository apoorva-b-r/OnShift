package com.onshift.app.notifications

class GenericParser : NotificationParser {
    override fun canParse(packageName: String, text: String): Boolean {
        return text.contains("payout", ignoreCase = true) || text.contains("earnings", ignoreCase = true)
    }

    override fun parse(packageName: String, text: String): ParsedNotificationEvidence? {
        if (!canParse(packageName, text)) return null
        return ParsedNotificationEvidence(
            platform = "GenericGigPlatform",
            amount = 5000.0,
            reference = "GENERIC-NOTIF-" + System.currentTimeMillis().toString().takeLast(6),
            rawSnippet = text
        )
    }
}
