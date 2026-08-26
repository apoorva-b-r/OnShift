package com.onshift.app

import com.onshift.app.data.hashchain.HashChain
import com.onshift.app.data.vault.*
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.UUID

class EvidencePersistenceTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var vaultFile: File
    private lateinit var encryptedStore: EncryptedEvidenceStore
    private lateinit var repository: LocalEncryptedEvidenceRepository

    @Before
    fun setUp() {
        vaultFile = File(tempFolder.newFolder(), "test_evidence_vault.enc")
        encryptedStore = EncryptedEvidenceStore.createForTest(vaultFile)
        repository = LocalEncryptedEvidenceRepository(encryptedStore)
    }

    @Test
    fun testA_BasicPersistence() {
        val record = repository.createAndSaveEvidence(
            workerId = "OS-DEMO-001",
            source = "OBSERVED",
            platform = "ZOMATO",
            eventType = "ORDER_COMPLETED",
            amount = 500.0,
            reference = "ZMT001"
        )

        // Recreate repository from the same encrypted store
        val newRepository = LocalEncryptedEvidenceRepository(encryptedStore)
        val loadedRecords = newRepository.getAllEvidence()

        assertEquals(1, loadedRecords.size)
        val loaded = loadedRecords[0]
        assertEquals(record.id, loaded.id)
        assertEquals("OS-DEMO-001", loaded.workerId)
        assertEquals("ZOMATO", loaded.platform)
        assertEquals(500.0, loaded.amount, 0.01)
        assertEquals("ZMT001", loaded.reference)
        assertEquals(record.integrityHash, loaded.integrityHash)
    }

    @Test
    fun testB_AppProcessRestartSimulation() {
        // Step 1: Save evidence in initial process lifetime
        repository.createAndSaveEvidence(
            platform = "SWIGGY",
            eventType = "ORDER_COMPLETED",
            amount = 350.0,
            reference = "SWG001"
        )

        // Step 2: Simulate process death by nullifying repository and creating a fresh instance
        val restartedRepository = LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(vaultFile))
        
        val evidence = restartedRepository.getAllEvidence()
        assertEquals(1, evidence.size)
        assertEquals("SWIGGY", evidence[0].platform)
        assertEquals(350.0, evidence[0].amount, 0.01)
    }

    @Test
    fun testC_MultipleRecordsPreservation() {
        // Persist ₹500 ORDER, ₹700 ORDER, ₹800 ORDER, ₹2,000 PAYOUT
        val e1 = repository.createAndSaveEvidence(platform = "ZOMATO", eventType = "ORDER_COMPLETED", amount = 500.0, reference = "ZMT001")
        val e2 = repository.createAndSaveEvidence(platform = "ZOMATO", eventType = "ORDER_COMPLETED", amount = 700.0, reference = "ZMT002")
        val e3 = repository.createAndSaveEvidence(platform = "ZOMATO", eventType = "ORDER_COMPLETED", amount = 800.0, reference = "ZMT003")
        val e4 = repository.createAndSaveEvidence(platform = "ZOMATO", eventType = "PAYOUT_COMPLETED", amount = 2000.0, reference = "PAY001")

        // Restart repository
        val reloadedRepository = LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(vaultFile))
        val reloaded = reloadedRepository.getAllEvidence()

        assertEquals(4, reloaded.size)
        assertEquals("ORDER_COMPLETED", reloaded[0].eventType)
        assertEquals("ORDER_EVENT", reloaded[0].role)
        assertEquals(500.0, reloaded[0].amount, 0.01)

        assertEquals("ORDER_COMPLETED", reloaded[1].eventType)
        assertEquals(700.0, reloaded[1].amount, 0.01)

        assertEquals("ORDER_COMPLETED", reloaded[2].eventType)
        assertEquals(800.0, reloaded[2].amount, 0.01)

        assertEquals("PAYOUT_COMPLETED", reloaded[3].eventType)
        assertEquals("PAYOUT_CLAIM", reloaded[3].role)
        assertEquals("PAYOUT", reloaded[3].category)
        assertEquals(2000.0, reloaded[3].amount, 0.01)
    }

    @Test
    fun testD_HashChainPersistence() {
        val e1 = repository.createAndSaveEvidence(platform = "ZOMATO", amount = 500.0)
        val e2 = repository.createAndSaveEvidence(platform = "ZOMATO", amount = 700.0)
        val e3 = repository.createAndSaveEvidence(platform = "ZOMATO", amount = 800.0)

        // Verify chain before restart
        assertTrue(repository.verifyIntegrity().valid)

        // Reload from storage
        val reloadedRepository = LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(vaultFile))
        val validation = reloadedRepository.verifyIntegrity()

        assertTrue(validation.valid)
        val reloaded = reloadedRepository.getAllEvidence()
        assertEquals(LocalEncryptedEvidenceRepository.GENESIS_HASH, reloaded[0].previousHash)
        assertEquals(reloaded[0].integrityHash, reloaded[1].previousHash)
        assertEquals(reloaded[1].integrityHash, reloaded[2].previousHash)
    }

    @Test
    fun testE_TamperedOrCorruptedEvidence() {
        // Save genuine records
        repository.createAndSaveEvidence(platform = "ZOMATO", amount = 500.0)
        repository.createAndSaveEvidence(platform = "ZOMATO", amount = 700.0)

        // Directly tamper vault file content
        val rawBytes = vaultFile.readBytes()
        // Corrupt several bytes in ciphertext area
        for (i in 15 until minOf(30, rawBytes.size)) {
            rawBytes[i] = (rawBytes[i].toInt() xor 0xFF).toByte()
        }
        vaultFile.writeBytes(rawBytes)

        // Instantiate repository on corrupted file
        val corruptedRepository = LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(vaultFile))
        
        assertTrue(corruptedRepository.isVaultCorrupted)
        val validation = corruptedRepository.verifyIntegrity()
        assertFalse(validation.valid)
        assertTrue(corruptedRepository.getAllEvidence().isEmpty())
    }

    @Test
    fun testF_DuplicateEvidenceDeduplication() {
        val rec1 = repository.createAndSaveEvidence(
            platform = "UBER",
            amount = 450.0,
            reference = "TRIP100"
        )

        // Persist duplicate evidence with same ID
        repository.saveEvidence(rec1)
        repository.saveEvidence(rec1)

        val reloadedRepo = LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(vaultFile))
        val allEvidence = reloadedRepo.getAllEvidence()

        assertEquals(1, allEvidence.size)
        assertEquals(450.0, allEvidence[0].amount, 0.01)
    }

    @Test
    fun testG_OfflineSync() {
        // Step 1: Save evidence offline
        val record = repository.createAndSaveEvidence(platform = "SWIGGY", amount = 300.0)
        assertEquals("UNSYNCED", record.syncStatus)

        val unsyncedBefore = repository.getUnsyncedEvidence()
        assertEquals(1, unsyncedBefore.size)

        // Step 2: Backend becomes available -> Sync evidence & mark synced
        repository.markSynced(record.id)

        val unsyncedAfter = repository.getUnsyncedEvidence()
        assertTrue(unsyncedAfter.isEmpty())

        // Step 3: Verify local evidence is NOT deleted after sync
        val allLocal = repository.getAllEvidence()
        assertEquals(1, allLocal.size)
        assertEquals("SYNCED", allLocal[0].syncStatus)
    }

    @Test
    fun testH_RestartBeforeSync() {
        // Step 1: Receive & persist evidence offline
        val record = repository.createAndSaveEvidence(platform = "ZOMATO", amount = 1200.0)
        assertEquals("UNSYNCED", record.syncStatus)

        // Step 2: Kill process & restart app before sync
        val restartedRepo = LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(vaultFile))
        val unsyncedOnRestart = restartedRepo.getUnsyncedEvidence()

        assertEquals(1, unsyncedOnRestart.size)
        assertEquals(record.id, unsyncedOnRestart[0].id)

        // Step 3: Backend sync succeeds
        restartedRepo.markSynced(record.id)
        assertEquals("SYNCED", restartedRepo.getEvidenceById(record.id)?.syncStatus)
    }

    @Test
    fun testI_EncryptionAtRest() {
        repository.createAndSaveEvidence(
            workerId = "SECRET-WORKER-99",
            platform = "CONFIDENTIAL-BANK",
            amount = 99999.0
        )

        // Verify that disk payload is NOT plaintext JSON
        assertFalse(encryptedStore.isPlaintextStored())
        
        val fileContent = String(vaultFile.readBytes(), Charsets.UTF_8)
        assertFalse(fileContent.contains("SECRET-WORKER-99"))
        assertFalse(fileContent.contains("CONFIDENTIAL-BANK"))
        assertFalse(fileContent.contains("99999.0"))
    }
}
