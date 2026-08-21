package com.onshift.app.notifications

import java.util.UUID

class GenericParser : NotificationParser {

    override fun canParse(notification: RawNotification): Boolean = true

    override fun parse(notification: RawNotification): ParseResult {
        val text = "${notification.title ?: ""} ${notification.text ?: ""}".trim()
        val warnings = mutableListOf("UNKNOWN_PLATFORM")

        val amountRegex = Regex("""(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE)
        val matches = amountRegex.findAll(text).toList()

        val amount = if (matches.size == 1) {
            matches[0].groupValues[1].replace(",", "").toDoubleOrNull()
        } else {
            if (matches.size > 1) warnings.add("AMOUNT_AMBIGUOUS") else warnings.add("AMOUNT_MISSING")
            null
        }

        val evidence = ObservedEvidence(
            evidenceId = "OBS-${UUID.randomUUID().toString().take(8).uppercase()}",
            source = "OBSERVED_NOTIFICATION",
            platform = Platform.UNKNOWN,
            eventType = EventType.UNKNOWN,
            amount = amount,
            currency = "INR",
            orderId = null,
            observedAt = notification.timestamp.toString(),
            extractionConfidence = if (amount != null) ExtractionConfidence.LOW else ExtractionConfidence.NONE,
            warnings = warnings,
            provenance = Provenance(
                parser = "GenericParser",
                sourceType = "ANDROID_NOTIFICATION"
            )
        )

        return ParseResult(
            success = amount != null,
            evidence = evidence,
            warnings = warnings,
            extractionConfidence = evidence.extractionConfidence
        )
    }
}