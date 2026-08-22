package com.onshift.app.data.vault

import com.onshift.app.data.hashchain.HashChain
import com.onshift.app.data.hashchain.HashChainValidationResult
import java.io.File
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

class LocalEncryptedEvidenceRepository(
    private val encryptedStore: EncryptedEvidenceStore? = null
) : EvidenceRepository {

    companion object {
        const val GENESIS_HASH = "GENESIS_0000000000000000000000000000000000000000000000000000000000000000"
        
        private val defaultVaultFile by lazy {
            File("build/vault/evidence_vault.enc")
        }

        val instance: LocalEncryptedEvidenceRepository by lazy {
            LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(defaultVaultFile))
        }

        fun createForTest(vaultFile: File): LocalEncryptedEvidenceRepository {
            return LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(vaultFile))
        }
    }

    private val recordsList = CopyOnWriteArrayList<EvidenceRecord>()
    private var isCorrupted: Boolean = false
    private var corruptionReason: String? = null

    init {
        loadFromStorage()
    }

    @Synchronized
    private fun loadFromStorage() {
        recordsList.clear()
        isCorrupted = false
        corruptionReason = null

        val store = encryptedStore ?: return
        try {
            val loaded = store.readRecords()
            val chainValidation = HashChain.verifyHashChain(loaded)
            if (!chainValidation.valid) {
                isCorrupted = true
                corruptionReason = chainValidation.reason
                // We do NOT repair the chain. Corrupted records are retained for auditing but flagged as untrusted.
                recordsList.addAll(loaded)
            } else {
                recordsList.addAll(loaded)
            }
        } catch (e: StorageCorruptionException) {
            isCorrupted = true
            corruptionReason = "Storage corruption: ${e.message}"
        } catch (e: Exception) {
            isCorrupted = true
            corruptionReason = "Failed to load vault: ${e.message}"
        }
    }

    val isVaultCorrupted: Boolean
        get() = isCorrupted

    val vaultCorruptionReason: String?
        get() = corruptionReason

    @Synchronized
    override fun saveEvidence(record: EvidenceRecord) {
        if (isCorrupted) {
            // Cannot trust saving to a corrupted vault without explicit reset
        }

        val existingIndex = recordsList.indexOfFirst { it.id == record.id }
        if (existingIndex >= 0) {
            // Deduplication: record with same ID exists. Update without duplicating.
            recordsList[existingIndex] = record
        } else {
            recordsList.add(record)
        }

        encryptedStore?.writeRecords(recordsList.toList())
    }

    @Synchronized
    fun createAndSaveEvidence(
        workerId: String = "OS-DEMO-001",
        source: String = "OBSERVED",
        platform: String,
        eventType: String = "ORDER_COMPLETED",
        type: String = eventType,
        role: String = if (eventType == "PAYOUT_COMPLETED" || type == "PAYOUT_COMPLETED") "PAYOUT_CLAIM"
                        else if (eventType == "AA_BANK_SETTLEMENT" || type == "AA_BANK_SETTLEMENT") "SETTLEMENT"
                        else if (eventType == "DEDUCTION" || type == "DEDUCTION") "DEDUCTION"
                        else "ORDER_EVENT",
        category: String = if (role == "PAYOUT_CLAIM") "PAYOUT" else "EARNING",
        amount: Double,
        currency: String = "INR",
        reference: String = "",
        timestamp: Long = System.currentTimeMillis(),
        rawMetadata: String = "{}"
    ): EvidenceRecord {
        val previousHash = recordsList.lastOrNull()?.integrityHash ?: GENESIS_HASH
        val id = if (reference.isNotBlank()) "ev-$platform-${reference.lowercase()}" else UUID.randomUUID().toString()

        val draftRecord = EvidenceRecord(
            id = id,
            workerId = workerId,
            source = source,
            platform = platform,
            eventType = eventType,
            type = type,
            role = role,
            category = category,
            amount = amount,
            currency = currency,
            timestamp = timestamp,
            reference = reference,
            previousHash = previousHash,
            integrityHash = "",
            syncStatus = "UNSYNCED",
            rawMetadata = rawMetadata
        )

        val computedHash = HashChain.calculateRecordHash(draftRecord, previousHash)
        val finalRecord = draftRecord.copy(integrityHash = computedHash)

        saveEvidence(finalRecord)
        return finalRecord
    }

    @Synchronized
    override fun getAllEvidence(): List<EvidenceRecord> {
        if (isCorrupted) {
            return emptyList()
        }
        return recordsList.toList()
    }

    @Synchronized
    override fun getEvidenceById(id: String): EvidenceRecord? {
        if (isCorrupted) return null
        return recordsList.find { it.id == id }
    }

    @Synchronized
    override fun getUnsyncedEvidence(): List<EvidenceRecord> {
        if (isCorrupted) return emptyList()
        return recordsList.filter { it.syncStatus != "SYNCED" }
    }

    @Synchronized
    override fun markSyncing(id: String) {
        val index = recordsList.indexOfFirst { it.id == id }
        if (index >= 0) {
            recordsList[index] = recordsList[index].copy(syncStatus = "SYNCING")
            encryptedStore?.writeRecords(recordsList.toList())
        }
    }

    @Synchronized
    override fun markSynced(id: String) {
        val index = recordsList.indexOfFirst { it.id == id }
        if (index >= 0) {
            recordsList[index] = recordsList[index].copy(syncStatus = "SYNCED")
            encryptedStore?.writeRecords(recordsList.toList())
        }
    }

    @Synchronized
    override fun markSynced(ids: List<String>) {
        var changed = false
        for (id in ids) {
            val index = recordsList.indexOfFirst { it.id == id }
            if (index >= 0) {
                recordsList[index] = recordsList[index].copy(syncStatus = "SYNCED")
                changed = true
            }
        }
        if (changed) {
            encryptedStore?.writeRecords(recordsList.toList())
        }
    }

    @Synchronized
    override fun clearVault() {
        recordsList.clear()
        isCorrupted = false
        corruptionReason = null
        encryptedStore?.writeRecords(emptyList())
    }

    @Synchronized
    override fun verifyIntegrity(): HashChainValidationResult {
        if (isCorrupted) {
            return HashChainValidationResult(
                valid = false,
                reason = corruptionReason ?: "Vault storage is corrupted."
            )
        }
        return HashChain.verifyHashChain(recordsList.toList())
    }
}