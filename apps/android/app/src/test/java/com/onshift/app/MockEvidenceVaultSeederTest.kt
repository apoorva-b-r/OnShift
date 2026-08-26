package com.onshift.app

import com.google.gson.Gson
import com.onshift.app.data.vault.*
import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class MockEvidenceVaultSeederTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private lateinit var vaultFile: File
    private lateinit var encryptedStore: EncryptedEvidenceStore
    private lateinit var repository: LocalEncryptedEvidenceRepository

    @Before
    fun setUp() {
        vaultFile = File(tempFolder.newFolder(), "test_fixture_vault.enc")
        encryptedStore = EncryptedEvidenceStore.createForTest(vaultFile)
        repository = LocalEncryptedEvidenceRepository(encryptedStore)
    }

    @Test
    fun test1_FixtureParsingAndRepositoryInsertion() {
        val sampleJson = """
            {
              "version": "1.0",
              "workerId": "sadhana.r@somaiya.edu",
              "records": [
                {
                  "id": "ev-sadhana-declared-001",
                  "workerId": "sadhana.r@somaiya.edu",
                  "source": "DECLARED",
                  "platform": "Uploaded document",
                  "amount": 30500.0,
                  "previousHash": "GENESIS_0000000000000000000000000000000000000000000000000000000000000000",
                  "integrityHash": "hash1"
                },
                {
                  "id": "ev-sadhana-observed-002",
                  "workerId": "sadhana.r@somaiya.edu",
                  "source": "OBSERVED",
                  "platform": "Zomato",
                  "amount": 18200.0,
                  "previousHash": "hash1",
                  "integrityHash": "hash2"
                }
              ]
            }
        """.trimIndent()

        val parsed = Gson().fromJson(sampleJson, MockEvidenceVaultJson::class.java)
        assertEquals(2, parsed.records.size)
        assertEquals("sadhana.r@somaiya.edu", parsed.workerId)

        // Insert records THROUGH repository
        for (rec in parsed.records) {
            repository.saveEvidence(rec)
        }

        val stored = repository.getEvidenceForWorker("sadhana.r@somaiya.edu")
        assertEquals(2, stored.size)
    }

    @Test
    fun test2_WorkerScoping() {
        repository.saveEvidence(
            EvidenceRecord(
                id = "rec-sadhana-1",
                workerId = "sadhana.r@somaiya.edu",
                platform = "Zomato",
                amount = 1000.0,
                previousHash = "gen",
                integrityHash = "h1"
            )
        )
        repository.saveEvidence(
            EvidenceRecord(
                id = "rec-other-1",
                workerId = "other.worker@example.com",
                platform = "Swiggy",
                amount = 500.0,
                previousHash = "h1",
                integrityHash = "h2"
            )
        )

        val sadhanaRecords = repository.getEvidenceForWorker("sadhana.r@somaiya.edu")
        assertEquals(1, sadhanaRecords.size)
        assertEquals("rec-sadhana-1", sadhanaRecords[0].id)
    }

    @Test
    fun test3_Idempotency() {
        val rec = EvidenceRecord(
            id = "ev-sadhana-declared-001",
            workerId = "sadhana.r@somaiya.edu",
            platform = "Uploaded document",
            amount = 30500.0,
            previousHash = "gen",
            integrityHash = "h1"
        )

        // Seed 1st time
        var inserted = 0
        if (repository.getEvidenceById(rec.id) == null) {
            repository.saveEvidence(rec)
            inserted++
        }
        assertEquals(1, inserted)
        assertEquals(1, repository.getAllEvidence().size)

        // Seed 2nd time (should be skipped)
        var secondInserted = 0
        if (repository.getEvidenceById(rec.id) == null) {
            repository.saveEvidence(rec)
            secondInserted++
        }
        assertEquals(0, secondInserted)
        assertEquals(1, repository.getAllEvidence().size)
    }

    @Test
    fun test4_PersistenceAcrossProcessRestarts() {
        val rec = EvidenceRecord(
            id = "ev-sadhana-financial-004",
            workerId = "sadhana.r@somaiya.edu",
            source = "FINANCIAL",
            platform = "HDFC Bank",
            amount = 30100.0,
            previousHash = LocalEncryptedEvidenceRepository.GENESIS_HASH,
            integrityHash = "h1"
        )
        val hash = com.onshift.app.data.hashchain.HashChain.calculateRecordHash(rec, LocalEncryptedEvidenceRepository.GENESIS_HASH)
        val validRec = rec.copy(integrityHash = hash)
        repository.saveEvidence(validRec)

        // Simulate app process restart by creating a new repository with the same encrypted store
        val restartedRepo = LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(vaultFile))
        val reloaded = restartedRepo.getEvidenceForWorker("sadhana.r@somaiya.edu")

        assertEquals(1, reloaded.size)
        assertEquals("ev-sadhana-financial-004", reloaded[0].id)
        assertEquals("HDFC Bank", reloaded[0].platform)
        assertEquals(30100.0, reloaded[0].amount, 0.01)
    }
}
