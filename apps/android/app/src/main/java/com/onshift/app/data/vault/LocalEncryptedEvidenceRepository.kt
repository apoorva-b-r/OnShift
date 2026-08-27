package com.onshift.app.data.vault

import android.content.Context
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

        @Volatile
        private var INSTANCE: LocalEncryptedEvidenceRepository? = null

        val instance: LocalEncryptedEvidenceRepository by lazy {
            try {
                LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(defaultVaultFile))
            } catch (_: Exception) {
                LocalEncryptedEvidenceRepository(null)
            }
        }

        fun createInstance(context: Context): LocalEncryptedEvidenceRepository {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: run {
                    val vaultDir = File(context.noBackupFilesDir, "onshift_vault")
                    vaultDir.mkdirs()
                    val vaultFile = File(vaultDir, "evidence_vault.enc")
                    val repo = try {
                        LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(vaultFile))
                    } catch (_: Exception) {
                        LocalEncryptedEvidenceRepository(null)
                    }
                    INSTANCE = repo
                    repo
                }
            }
        }

        fun createForTest(vaultFile: File): LocalEncryptedEvidenceRepository {
            return try {
                LocalEncryptedEvidenceRepository(EncryptedEvidenceStore.createForTest(vaultFile))
            } catch (_: Exception) {
                LocalEncryptedEvidenceRepository(null)
            }
        }
    }

    private val recordsList = CopyOnWriteArrayList<EvidenceRecord>()
    private val _recordsFlow = kotlinx.coroutines.flow.MutableStateFlow<List<EvidenceRecord>>(emptyList())
    val recordsFlow: kotlinx.coroutines.flow.StateFlow<List<EvidenceRecord>> = _recordsFlow

    private var isCorrupted: Boolean = false
    private var corruptionReason: String? = null

    init {
        loadFromStorage()
        if (recordsList.isEmpty() && encryptedStore == null) {
            createAndSaveEvidence(source = "OBSERVED", platform = "Zomato", amount = 1250.0)
            createAndSaveEvidence(source = "OBSERVED", platform = "Swiggy", amount = 890.0)
            createAndSaveEvidence(source = "FINANCIAL", platform = "Bank AA", amount = 30100.0)
            createAndSaveEvidence(source = "DECLARED", platform = "Uploaded document", amount = 2400.0)
        }
        _recordsFlow.value = recordsList.toList()
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
        _recordsFlow.value = recordsList.toList()
    }

    val isVaultCorrupted: Boolean
        get() = isCorrupted

    val vaultCorruptionReason: String?
        get() = corruptionReason

    @Synchronized
    override fun saveEvidence(record: EvidenceRecord) {
        val existingIndex = recordsList.indexOfFirst { it.id == record.id }
        if (existingIndex >= 0) {
            recordsList[existingIndex] = record
        } else {
            recordsList.add(record)
        }

        try {
            encryptedStore?.writeRecords(recordsList.toList())
        } catch (_: Exception) {}

        _recordsFlow.value = recordsList.toList()
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
        return recordsList.toList()
    }

    @Synchronized
    override fun getEvidenceForWorker(workerId: String): List<EvidenceRecord> {
        val all = recordsList.toList()
        return all
    }

    @Synchronized
    override fun getEvidenceById(id: String): EvidenceRecord? {
        return recordsList.find { it.id == id }
    }

    @Synchronized
    override fun getUnsyncedEvidence(): List<EvidenceRecord> {
        return recordsList.filter { it.syncStatus != "SYNCED" }
    }

    @Synchronized
    override fun markSyncing(id: String) {
        val index = recordsList.indexOfFirst { it.id == id }
        if (index >= 0) {
            recordsList[index] = recordsList[index].copy(syncStatus = "SYNCING")
            try {
                encryptedStore?.writeRecords(recordsList.toList())
            } catch (_: Exception) {}
            _recordsFlow.value = recordsList.toList()
        }
    }

    @Synchronized
    override fun markSynced(id: String) {
        val index = recordsList.indexOfFirst { it.id == id }
        if (index >= 0) {
            recordsList[index] = recordsList[index].copy(syncStatus = "SYNCED")
            try {
                encryptedStore?.writeRecords(recordsList.toList())
            } catch (_: Exception) {}
            _recordsFlow.value = recordsList.toList()
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
            try {
                encryptedStore?.writeRecords(recordsList.toList())
            } catch (_: Exception) {}
            _recordsFlow.value = recordsList.toList()
        }
    }

    @Synchronized
    override fun clearVault() {
        recordsList.clear()
        isCorrupted = false
        corruptionReason = null
        try {
            encryptedStore?.writeRecords(emptyList())
        } catch (_: Exception) {}
        _recordsFlow.value = emptyList()
    }

    @Synchronized
    fun tamperFirstRecord() {
        if (recordsList.isNotEmpty()) {
            val first = recordsList.first()
            val tampered = first.copy(amount = first.amount + 999.0)
            recordsList[0] = tampered
            isCorrupted = true
            corruptionReason = "Integrity hash failure at record ${first.id}. Content tampered or modified."
            try {
                encryptedStore?.writeRecords(recordsList.toList())
            } catch (_: Exception) {}
            _recordsFlow.value = recordsList.toList()
        }
    }

    @Synchronized
    fun resetVaultToValid() {
        recordsList.clear()
        isCorrupted = false
        corruptionReason = null
        createAndSaveEvidence(source = "OBSERVED", platform = "Zomato", amount = 1250.0)
        createAndSaveEvidence(source = "OBSERVED", platform = "Swiggy", amount = 890.0)
        createAndSaveEvidence(source = "FINANCIAL", platform = "Bank AA", amount = 30100.0)
        createAndSaveEvidence(source = "DECLARED", platform = "Uploaded document", amount = 2400.0)
        _recordsFlow.value = recordsList.toList()
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