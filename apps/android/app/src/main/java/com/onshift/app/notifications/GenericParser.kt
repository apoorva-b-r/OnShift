package com.onshift.app.notifications

import java.time.Instant
import java.util.UUID

class GenericParser : NotificationParser {

    override fun parse(title: String, body: String, notificationId: String, workerId: String): NormalizedEvidence? {
        val content = "$title $body"

        // 1. Determine Type & Category
        val isPayout = content.contains("payout", ignoreCase = true) ||
                content.contains("credited", ignoreCase = true) ||
                content.contains("settlement", ignoreCase = true)

        val type = if (isPayout) "PAYOUT_COMPLETED" else "EARNING_RECORDED"
        val category = if (isPayout) "PAYOUT" else "EARNING"

        // 2. Extract Amount
        val amountRegex = Regex("""(?:₹|Rs\.?|INR|\$)\s*([0-9]+(?:\.[0-9]{1,2})?)""", RegexOption.IGNORE_CASE)
        val amountMatch = amountRegex.find(content)
        val amount = amountMatch?.groupValues?.get(1)?.toDoubleOrNull() ?: return null

        // 3. Fallback Reference
        val refRegex = Regex("""(?:#|ID:?\s*|Ref:\s*)([A-Z0-9]+)""", RegexOption.IGNORE_CASE)
        val refMatch = refRegex.find(content)
        val reference = refMatch?.groupValues?.get(1) ?: "GEN-${UUID.randomUUID().toString().take(6).uppercase()}"

        return NormalizedEvidence(
            id = "obs-gen-${UUID.randomUUID().toString().take(8)}",
            workerId = workerId,
            source = "OBSERVED",
            type = type,
            category = category,
            platform = "GENERIC",
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