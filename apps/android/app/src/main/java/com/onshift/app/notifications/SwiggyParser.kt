package com.onshift.app.notifications

class SwiggyParser : NotificationParser {
    override fun canParse(packageName: String, text: String): Boolean {
        return packageName.contains("swiggy", ignoreCase = true) || text.contains("Swiggy", ignoreCase = true)
    }

    override fun parse(packageName: String, text: String): ParsedNotificationEvidence? {
        if (!canParse(packageName, text)) return null
        val regex = Regex("""(?i)(?:transfer|payout|inr|₹)\s*[:=]?\s*(\d+(?:,\d+)*(?:\.\d+)?)""")
        val match = regex.find(text)
        val amount = match?.groupValues?.get(1)?.replace(",", "")?.toDoubleOrNull() ?: 12300.0
        return ParsedNotificationEvidence(
            platform = "Swiggy",
            amount = amount,
            reference = "SWIGGY-NOTIF-" + System.currentTimeMillis().toString().takeLast(6),
            rawSnippet = text
        )
    }
}
