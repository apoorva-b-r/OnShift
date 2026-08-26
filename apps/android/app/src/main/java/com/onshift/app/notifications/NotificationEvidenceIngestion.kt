package com.onshift.app.notifications

import com.onshift.app.data.vault.LocalEncryptedEvidenceRepository
import java.time.Instant

/**
 * The sole notification ingestion path. Both live listener events and demo fixtures call this,
 * so parsing, encrypted persistence, and repository-owned hash-chain creation remain identical.
 */
class NotificationEvidenceIngestion(
    private val repository: LocalEncryptedEvidenceRepository
) {
    fun ingest(input: NotificationInput, workerId: String): Boolean {
        val parser = PlatformRegistry.getParserForPackage(input.packageName, "${input.title} ${input.body}")
        val normalized = parser.parse(input.title, input.body, input.notificationId, workerId) ?: return false
        repository.createAndSaveEvidence(
            workerId = normalized.workerId,
            source = normalized.source,
            platform = normalized.platform,
            eventType = normalized.type,
            type = normalized.type,
            category = normalized.category,
            amount = normalized.amount,
            reference = normalized.reference,
            timestamp = runCatching { Instant.parse(normalized.timestamp).toEpochMilli() }
                .getOrDefault(System.currentTimeMillis()),
            // Raw notification text is deliberately not retained outside the encrypted repository.
            rawMetadata = "{\"notificationId\":\"${normalized.metadata.rawNotificationId}\",\"parserVersion\":\"${normalized.metadata.parserVersion}\"}"
        )
        return true
    }
}

data class NotificationInput(
    val packageName: String,
    val title: String,
    val body: String,
    val notificationId: String
)

/** Deterministic demo fixtures use the exact same [NotificationEvidenceIngestion.ingest] pipeline. */
object NotificationFixtures {
    val orderCompleted = NotificationInput(
        packageName = PlatformRegistry.ZOMATO_PACKAGE,
        title = "Order delivered",
        body = "Order #ZMT-DEMO-001 completed. You earned INR 420.00",
        notificationId = "fixture-zomato-order-001"
    )

    fun injectOrderCompleted(ingestion: NotificationEvidenceIngestion, workerId: String): Boolean =
        ingestion.ingest(orderCompleted, workerId)
}
