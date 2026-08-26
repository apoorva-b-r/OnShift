package com.onshift.app.notifications

import com.onshift.app.data.hashchain.HashChainValidationResult
import com.onshift.app.data.model.UserPreferences
import com.onshift.app.data.vault.EvidenceRecord
import com.onshift.app.data.vault.EvidenceRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OnShiftNotificationListenerServiceTest {
    private val allowedPackage = PlatformRegistry.ZOMATO_PACKAGE
    private val privateTitle = "Bank balance: INR 9,876"
    private val privateBody = "OTP 123456; this must never be parsed or stored"

    @Test
    fun allowlistedNotification_isParsedAndSavedWithExpectedFields() {
        val repository = FakeRepository()
        val parser = RecordingParser(evidence(amount = 420.0, reference = "ZMT-42"))
        val boundary = boundary(setOf(allowedPackage), parser, repository)

        assertTrue(boundary.handle(allowedPackage, "worker-1") { input(allowedPackage) })
        assertEquals(1, parser.calls)
        assertEquals(1, repository.saved.size)
        assertEquals("ZOMATO", repository.saved.single().platform)
        assertEquals(420.0, repository.saved.single().amount, 0.0)
        assertEquals("ZMT-42", repository.saved.single().reference)
    }

    @Test
    fun nonAllowlistedNotification_isNotSaved_andNeverReachesParser() {
        val repository = FakeRepository()
        val parser = RecordingParser(evidence())
        val boundary = boundary(emptySet(), parser, repository)

        assertFalse(boundary.handle("com.bank.private", "worker-1") {
            error("Discarded notification content must not be accessed")
        })
        assertEquals(0, parser.calls)
        assertTrue(repository.saved.isEmpty())
    }

    @Test
    fun discardedNotification_logContainsOnlyDiscardLabelAndPackage() {
        val logs = mutableListOf<String>()
        val boundary = NotificationPrivacyBoundary(
            allowlistProvider = { emptySet() },
            parserForAllowedPackage = { RecordingParser(evidence()) },
            repository = FakeRepository(),
            discardLogger = { message -> logs.add(message) }
        )

        boundary.handle("com.bank.private", "worker-1") { input("com.bank.private") }
        assertEquals(listOf("discarded package=com.bank.private"), logs)
        assertFalse(logs.single().contains(privateTitle))
        assertFalse(logs.single().contains(privateBody))
    }

    @Test
    fun changingSelectedPlatforms_changesAllowlistAtRuntime() {
        var preferences = UserPreferences(selectedPlatforms = listOf("ZOMATO"))
        val repository = FakeRepository()
        val parser = RecordingParser(evidence())
        val boundary = NotificationPrivacyBoundary(
            allowlistProvider = { resolveAllowlist(preferences) },
            parserForAllowedPackage = { parser },
            repository = repository
        )

        assertFalse(boundary.handle(PlatformRegistry.SWIGGY_PACKAGE, "worker-1") { input(PlatformRegistry.SWIGGY_PACKAGE) })
        preferences = preferences.copy(selectedPlatforms = listOf("ZOMATO", "SWIGGY"))
        assertTrue(boundary.handle(PlatformRegistry.SWIGGY_PACKAGE, "worker-1") { input(PlatformRegistry.SWIGGY_PACKAGE) })
        assertEquals(1, parser.calls)
        assertEquals(1, repository.saved.size)
    }

    @Test
    fun emptyAllowlist_discardsEveryNotification() {
        val repository = FakeRepository()
        val parser = RecordingParser(evidence())
        val boundary = boundary(resolveAllowlist(UserPreferences()), parser, repository)

        assertFalse(boundary.handle(allowedPackage, "worker-1") { error("Content must remain unread") })
        assertEquals(0, parser.calls)
        assertTrue(repository.saved.isEmpty())
    }

    private fun boundary(allowlist: Set<String>, parser: RecordingParser, repository: FakeRepository) =
        NotificationPrivacyBoundary({ allowlist }, { parser }, repository)

    private fun input(packageName: String) = NotificationInput(packageName, privateTitle, privateBody, "notification-1")

    private fun evidence(amount: Double = 10.0, reference: String = "ref-1") = NormalizedEvidence(
        id = "evidence-1", workerId = "worker-1", type = "ORDER_COMPLETED", category = "EARNING",
        platform = "ZOMATO", timestamp = "2025-01-01T00:00:00Z", amount = amount, reference = reference,
        metadata = EvidenceMetadata(rawNotificationId = "notification-1")
    )

    private class RecordingParser(private val result: NormalizedEvidence?) : NotificationParser {
        var calls = 0
        override fun parse(title: String, body: String, notificationId: String, workerId: String): NormalizedEvidence? {
            calls++
            return result
        }
    }

    private class FakeRepository : EvidenceRepository {
        val saved = mutableListOf<EvidenceRecord>()
        override fun saveEvidence(record: EvidenceRecord) { saved += record }
        override fun getAllEvidence(): List<EvidenceRecord> = saved.toList()
        override fun getEvidenceById(id: String): EvidenceRecord? = saved.find { it.id == id }
        override fun getUnsyncedEvidence(): List<EvidenceRecord> = saved
        override fun markSyncing(id: String) = Unit
        override fun markSynced(id: String) = Unit
        override fun markSynced(ids: List<String>) = Unit
        override fun clearVault() { saved.clear() }
        override fun verifyIntegrity() = HashChainValidationResult(valid = true, reason = "test repository")
    }
}
