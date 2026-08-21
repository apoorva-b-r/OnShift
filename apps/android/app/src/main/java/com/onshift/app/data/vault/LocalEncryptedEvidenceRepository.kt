package com.onshift.app.data.vault

import com.onshift.app.data.hashchain.HashChain
import java.util.UUID

class LocalEncryptedEvidenceRepository : EvidenceRepository {

    companion object {
        val instance = LocalEncryptedEvidenceRepository()
        private const val GENESIS_HASH = "GENESIS_0000000000000000000000000000000000000000000000000000000000000000"
    }

    private val memoryStore = mutableListOf<EvidenceRecord>()

    @Synchronized
    override fun saveEvidence(record: EvidenceRecord) {
        memoryStore.add(record)
    }

    @Synchronized
    fun createAndSaveEvidence(
        workerId: String = "WORKER_DEMO_01",
        source: String = "NOTIFICATION_LISTENER",
        platform: String,
        amount: Double,
        timestamp: Long = System.currentTimeMillis()
    ): EvidenceRecord {
        val previousHash = memoryStore.lastOrNull()?.integrityHash ?: GENESIS_HASH
        val id = UUID.randomUUID().toString()

        val draftRecord = EvidenceRecord(
            id = id,
            workerId = workerId,
            source = source,
            platform = platform,
            amount = amount,
            timestamp = timestamp,
            previousHash = previousHash,
            integrityHash = ""
        )

        val computedHash = HashChain.calculateRecordHash(draftRecord, previousHash)
        val finalRecord = draftRecord.copy(integrityHash = computedHash)

        saveEvidence(finalRecord)
        return finalRecord
    }

    @Synchronized
    override fun getAllEvidence(): List<EvidenceRecord> {
        return memoryStore.toList()
    }

    @Synchronized
    override fun getEvidenceById(id: String): EvidenceRecord? {
        return memoryStore.find { it.id == id }
    }

    @Synchronized
    override fun clearVault() {
        memoryStore.clear()
    }
}