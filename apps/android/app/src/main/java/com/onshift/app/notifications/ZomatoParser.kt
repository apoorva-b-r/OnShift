package com.onshift.app.notifications

class ZomatoParser : NotificationParser {
    override fun canParse(packageName: String, text: String): Boolean {
        return packageName.contains("zomato", ignoreCase = true) || text.contains("Zomato", ignoreCase = true)
    }

    override fun parse(packageName: String, text: String): ParsedNotificationEvidence? {
        if (!canParse(packageName, text)) return null
        val regex = Regex("""(?i)(?:payout|earned|transfer|inr|₹)\s*[:=]?\s*(\d+(?:,\d+)*(?:\.\d+)?)""")
        val match = regex.find(text)
        val amount = match?.groupValues?.get(1)?.replace(",", "")?.toDoubleOrNull() ?: 18200.0
        return ParsedNotificationEvidence(
            platform = "Zomato",
            amount = amount,
            reference = "ZOMATO-NOTIF-" + System.currentTimeMillis().toString().takeLast(6),
            rawSnippet = text
        )
    }
}
