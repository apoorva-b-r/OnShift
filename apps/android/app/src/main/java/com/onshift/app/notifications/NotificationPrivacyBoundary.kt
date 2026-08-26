package com.onshift.app.notifications

import com.onshift.app.data.hashchain.HashChain
import com.onshift.app.data.model.UserPreferences
import com.onshift.app.data.vault.EvidenceRecord
import com.onshift.app.data.vault.EvidenceRepository
import com.onshift.app.data.vault.LocalEncryptedEvidenceRepository
import java.time.Instant

/** Resolves the worker-specific package allowlist stored by onboarding preferences. */
fun resolveAllowlist(workerPreferences: UserPreferences): Set<String> =
    PlatformRegistry.allowedPackages(workerPreferences.selectedPlatforms)

/**
 * A framework-free privacy boundary so it can be proven in fast JVM tests.
 * The [inputProvider] is deliberately lazy: discarded notifications never expose title or body.
 */
class NotificationPrivacyBoundary(
    private val allowlistProvider: () -> Set<String>,
    private val parserForAllowedPackage: (String) -> NotificationParser,
    private val repository: EvidenceRepository,
    private val discardLogger: (String) -> Unit = {}
) {
    fun handle(packageName: String, workerId: String, inputProvider: () -> NotificationInput): Boolean {
        // Step 1: inspect only the source package name before notification content.
        if (packageName !in allowlistProvider()) {
            // Step 2: discard before parsing, persistence, or any content-bearing log statement.
            discardLogger("discarded package=$packageName")
            return false
        }

        // Step 3: only an allowed package may expose content to a parser and repository.
        val input = inputProvider()
        val normalized = parserForAllowedPackage(packageName).parse(
            input.title, input.body, input.notificationId, workerId
        ) ?: return false
        saveEvidence(normalized)
        return true
    }

    private fun saveEvidence(normalized: NormalizedEvidence) {
        val previousHash = repository.getAllEvidence().lastOrNull()?.integrityHash
            ?: LocalEncryptedEvidenceRepository.GENESIS_HASH
        val timestamp = runCatching { Instant.parse(normalized.timestamp).toEpochMilli() }
            .getOrDefault(System.currentTimeMillis())
        val draft = EvidenceRecord(
            id = normalized.id,
            workerId = normalized.workerId,
            source = normalized.source,
            platform = normalized.platform,
            eventType = normalized.type,
            type = normalized.type,
            category = normalized.category,
            amount = normalized.amount,
            timestamp = timestamp,
            reference = normalized.reference,
            previousHash = previousHash,
            integrityHash = "",
            // Content is intentionally excluded; only non-content parser metadata is retained.
            rawMetadata = "{\"notificationId\":\"${normalized.metadata.rawNotificationId}\",\"parserVersion\":\"${normalized.metadata.parserVersion}\"}"
        )
        repository.saveEvidence(draft.copy(integrityHash = HashChain.calculateRecordHash(draft, previousHash)))
    }
}
