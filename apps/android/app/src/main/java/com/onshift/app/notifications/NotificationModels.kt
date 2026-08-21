package com.onshift.app.notifications

import java.time.Instant

enum class Platform {
    ZOMATO,
    SWIGGY,
    UBER,
    UNKNOWN
}

enum class EventType {
    ORDER_CREATED,
    ORDER_ACCEPTED,
    ORDER_PICKED_UP,
    ORDER_COMPLETED,
    DELIVERY_COMPLETED,
    TRIP_COMPLETED,
    EARNING_RECORDED,
    PAYOUT_INITIATED,
    PAYOUT_COMPLETED,
    UNKNOWN
}

enum class ExtractionConfidence {
    HIGH,
    MEDIUM,
    LOW,
    NONE
}

data class RawNotification(
    val packageName: String,
    val title: String?,
    val text: String?,
    val timestamp: Instant = Instant.now(),
    val notificationId: String? = null
)

data class Provenance(
    val parser: String,
    val sourceType: String = "ANDROID_NOTIFICATION"
)

data class ObservedEvidence(
    val evidenceId: String,
    val source: String = "OBSERVED_NOTIFICATION",
    val platform: Platform,
    val eventType: EventType,
    val amount: Double?,
    val currency: String = "INR",
    val orderId: String?,
    val observedAt: String,
    val extractionConfidence: ExtractionConfidence,
    val warnings: List<String> = emptyList(),
    val provenance: Provenance
)

data class ParseResult(
    val success: Boolean,
    val evidence: ObservedEvidence?,
    val warnings: List<String> = emptyList(),
    val extractionConfidence: ExtractionConfidence
)