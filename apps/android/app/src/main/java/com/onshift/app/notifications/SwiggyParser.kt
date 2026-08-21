package com.onshift.app.notifications

import java.util.UUID

class SwiggyParser : NotificationParser {

    override fun canParse(notification: RawNotification): Boolean {
        return notification.packageName.contains("swiggy", ignoreCase = true)
    }

    override fun parse(notification: RawNotification): ParseResult {
        val text = "${notification.title ?: ""} ${notification.text ?: ""}".trim()
        val warnings = mutableListOf<String>()

        if (text.isEmpty()) {
            return ParseResult(
                success = false,
                evidence = null,
                warnings = listOf("EMPTY_NOTIFICATION_TEXT"),
                extractionConfidence = ExtractionConfidence.NONE
            )
        }

        val eventType = when {
            text.contains("payout", ignoreCase = true) || text.contains("transferred", ignoreCase = true) -> EventType.PAYOUT_COMPLETED
            text.contains("completed", ignoreCase = true) || text.contains("delivered", ignoreCase = true) -> EventType.ORDER_COMPLETED
            text.contains("earned", ignoreCase = true) || text.contains("credited", ignoreCase = true) -> EventType.EARNING_RECORDED
            else -> EventType.UNKNOWN
        }

        // Specifically requires # or id: after order/delivery to avoid matching words like "Delivery completed"
        val orderIdRegex = Regex("""(?:order\s*(?:#|id:?)|delivery\s*#)\s*([A-Za-z0-9_-]+)""", RegexOption.IGNORE_CASE)
        val orderId = orderIdRegex.find(text)?.groupValues?.get(1)

        val amountRegex = Regex("""(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE)
        val matches = amountRegex.findAll(text).toList()

        val amount: Double?
        val confidence: ExtractionConfidence

        if (matches.size > 1) {
            warnings.add("AMOUNT_AMBIGUOUS")
            amount = null
            confidence = ExtractionConfidence.LOW
        } else if (matches.size == 1) {
            amount = matches[0].groupValues[1].replace(",", "").toDoubleOrNull()
            confidence = if (eventType != EventType.UNKNOWN && amount != null) ExtractionConfidence.HIGH else ExtractionConfidence.MEDIUM
        } else {
            warnings.add("AMOUNT_MISSING")
            amount = null
            confidence = if (eventType != EventType.UNKNOWN) ExtractionConfidence.MEDIUM else ExtractionConfidence.LOW
        }

        val evidence = ObservedEvidence(
            evidenceId = "OBS-${UUID.randomUUID().toString().take(8).uppercase()}",
            source = "OBSERVED_NOTIFICATION",
            platform = Platform.SWIGGY,
            eventType = eventType,
            amount = amount,
            currency = "INR",
            orderId = orderId,
            observedAt = notification.timestamp.toString(),
            extractionConfidence = confidence,
            warnings = warnings,
            provenance = Provenance(
                parser = "SwiggyParser",
                sourceType = "ANDROID_NOTIFICATION"
            )
        )

        return ParseResult(
            success = true,
            evidence = evidence,
            warnings = warnings,
            extractionConfidence = confidence
        )
    }
}