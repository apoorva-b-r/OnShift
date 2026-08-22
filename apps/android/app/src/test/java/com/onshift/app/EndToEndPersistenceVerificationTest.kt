package com.onshift.app

import com.onshift.app.data.hashchain.HashChain
import com.onshift.app.data.vault.EncryptedEvidenceStore
import com.onshift.app.data.vault.LocalEncryptedEvidenceRepository
import com.onshift.app.notifications.ZomatoParser
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class EndToEndPersistenceVerificationTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var vaultFile: File
    private lateinit var repository: LocalEncryptedEvidenceRepository
    private val workerId = "OS-DEMO-001"

    @Before
    fun setUp() {
        vaultFile = File(tempFolder.newFolder(), "e2e_evidence_vault.enc")
        repository = LocalEncryptedEvidenceRepository.createForTest(vaultFile)
    }

    @Test
    fun testEndToEndPersistenceVerificationFlow() {
        val parser = ZomatoParser()

        // 1. Receive & parse 3 Zomato Order notifications and 1 Zomato Payout notification
        val notif1 = parser.parse("Order Delivered", "Order #ZMT001 completed. You earned ₹500.00", "n-01", workerId)
        val notif2 = parser.parse("Order Delivered", "Order #ZMT002 completed. You earned ₹700.00", "n-02", workerId)
        val notif3 = parser.parse("Order Delivered", "Order #ZMT003 completed. You earned ₹800.00", "n-03", workerId)
        val notif4 = parser.parse("Weekly Payout", "Zomato payout of Rs. 2000 transferred. Ref: TXN_PAY_001", "n-04", workerId)

        assertNotNull(notif1)
        assertNotNull(notif2)
        assertNotNull(notif3)
        assertNotNull(notif4)

        // 2. Persist in encrypted repository with hash chain
        repository.createAndSaveEvidence(
            workerId = workerId,
            source = notif1!!.source,
            platform = notif1.platform,
            eventType = notif1.type,
            type = notif1.type,
            role = "ORDER_EVENT",
            category = notif1.category,
            amount = notif1.amount,
            reference = notif1.reference
        )

        repository.createAndSaveEvidence(
            workerId = workerId,
            source = notif2!!.source,
            platform = notif2.platform,
            eventType = notif2.type,
            type = notif2.type,
            role = "ORDER_EVENT",
            category = notif2.category,
            amount = notif2.amount,
            reference = notif2.reference
        )

        repository.createAndSaveEvidence(
            workerId = workerId,
            source = notif3!!.source,
            platform = notif3.platform,
            eventType = notif3.type,
            type = notif3.type,
            role = "ORDER_EVENT",
            category = notif3.category,
            amount = notif3.amount,
            reference = notif3.reference
        )

        repository.createAndSaveEvidence(
            workerId = workerId,
            source = notif4!!.source,
            platform = notif4.platform,
            eventType = notif4.type,
            type = notif4.type,
            role = "PAYOUT_CLAIM",
            category = notif4.category,
            amount = notif4.amount,
            reference = notif4.reference
        )

        // 3. Simulate process death
        val restartedRepo = LocalEncryptedEvidenceRepository.createForTest(vaultFile)

        // 4. Verify integrity and reload
        val validation = restartedRepo.verifyIntegrity()
        assertTrue(validation.valid)

        val loadedRecords = restartedRepo.getAllEvidence()
        assertEquals(4, loadedRecords.size)

        // Calculate gross earnings sum across ORDER_EVENT records
        val orderEarnings = loadedRecords.filter { it.role == "ORDER_EVENT" }.sumOf { it.amount }
        assertEquals(2000.0, orderEarnings, 0.01)

        // Payout claim amount
        val payoutClaim = loadedRecords.filter { it.role == "PAYOUT_CLAIM" }.sumOf { it.amount }
        assertEquals(2000.0, payoutClaim, 0.01)

        // Verify payout claim does not inflate gross order earnings (orderEarnings remain ₹2,000, not ₹4,000)
        assertNotEquals(4000.0, orderEarnings)

        // 5. Verify payload maps for backend sync
        val syncPayload = loadedRecords.map { it.toCanonicalMap() }
        assertEquals(4, syncPayload.size)
        assertEquals("ORDER_EVENT", syncPayload[0]["role"])
        assertEquals("PAYOUT_CLAIM", syncPayload[3]["role"])
    }
}
