package com.onshift.app.notifications

import java.time.Instant
import java.util.UUID

class UberParser : NotificationParser {

    override fun parse(title: String, body: String, notificationId: String, workerId: String): NormalizedEvidence? {
        val content = "$title $body"

        // 1. Determine Type & Category
        val isPayout = content.contains("cash out", ignoreCase = true) ||
                content.contains("payout", ignoreCase = true) ||
                content.contains("transfer completed", ignoreCase = true)

        val type = if (isPayout) "PAYOUT_COMPLETED" else "ORDER_COMPLETED"
        val category = if (isPayout) "PAYOUT" else "EARNING"

        // 2. Extract Amount
        val amountRegex = Regex("""(?:₹|Rs\.?|INR)\s*([0-9]+(?:\.[0-9]{1,2})?)""", RegexOption.IGNORE_CASE)
        val amountMatch = amountRegex.find(content)
        val amount = amountMatch?.groupValues?.get(1)?.toDoubleOrNull() ?: return null

        // 3. Extract Reference
        val refRegex = Regex("""(?:Trip\s*(?:#|ID:?)?\s*|UBER-?|Ref:\s*)([A-Z0-9]+)""", RegexOption.IGNORE_CASE)
        val refMatch = refRegex.find(content)
        val reference = refMatch?.groupValues?.get(1) ?: "UBR-${UUID.randomUUID().toString().take(6).uppercase()}"

        return NormalizedEvidence(
            id = "obs-uber-${UUID.randomUUID().toString().take(8)}",
            workerId = workerId,
            source = "OBSERVED",
            type = type,
            category = category,
            platform = "UBER",
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