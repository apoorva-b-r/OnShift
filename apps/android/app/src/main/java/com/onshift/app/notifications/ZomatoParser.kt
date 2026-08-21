package com.onshift.app.notifications

import java.time.Instant
import java.util.UUID

class ZomatoParser : NotificationParser {

    override fun parse(title: String, body: String, notificationId: String, workerId: String): NormalizedEvidence? {
        val content = "$title $body"

        // 1. Determine Type & Category
        val isPayout = content.contains("payout", ignoreCase = true) ||
                content.contains("transferred", ignoreCase = true) ||
                content.contains("bank", ignoreCase = true)

        val type = if (isPayout) "PAYOUT_COMPLETED" else "ORDER_COMPLETED"
        val category = if (isPayout) "PAYOUT" else "EARNING"

        // 2. Extract Amount (Supports ₹500, Rs. 500, Rs 500, 500.00)
        val amountRegex = Regex("""(?:₹|Rs\.?|INR)\s*([0-9]+(?:\.[0-9]{1,2})?)""", RegexOption.IGNORE_CASE)
        val amountMatch = amountRegex.find(content)
        val amount = amountMatch?.groupValues?.get(1)?.toDoubleOrNull() ?: return null

        // 3. Extract Reference (#ZMT4821, Ref: TXN9912, Order ID: ZMT4821, ZMT4821)
        val refRegex = Regex("""(?:#|ID:\s*|Ref:\s*|TXN-?|(?:ZMT-?))([A-Z0-9]+)""", RegexOption.IGNORE_CASE)
        val refMatch = refRegex.find(content)
        val reference = when {
            refMatch != null -> {
                val fullMatch = refMatch.value.trim()
                if (fullMatch.startsWith("#") || fullMatch.startsWith("Ref:", ignoreCase = true) || fullMatch.startsWith("ID:", ignoreCase = true)) {
                    refMatch.groupValues[1]
                } else {
                    fullMatch
                }
            }
            else -> "ZMT-${UUID.randomUUID().toString().take(6).uppercase()}"
        }

        return NormalizedEvidence(
            id = "obs-zomato-${UUID.randomUUID().toString().take(8)}",
            workerId = workerId,
            source = "OBSERVED",
            type = type,
            category = category,
            platform = "ZOMATO",
            timestamp = Instant.now().toString(),
            amount = amount,
            reference = reference,
            metadata = EvidenceMetadata(
                rawNotificationId = notificationId,
                parserVersion = "1.0",
                title = title
            )
        )
    }
}