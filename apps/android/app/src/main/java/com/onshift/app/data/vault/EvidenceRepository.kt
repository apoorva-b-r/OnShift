package com.onshift.app.data.vault

import com.onshift.app.data.hashchain.HashChainValidationResult

data class EvidenceRecord(
    val id: String,
    val workerId: String = "OS-DEMO-001",
    val source: String = "OBSERVED",
    val platform: String,
    val eventType: String = "ORDER_COMPLETED",
    val type: String = eventType,
    val role: String = if (eventType == "PAYOUT_COMPLETED" || type == "PAYOUT_COMPLETED") "PAYOUT_CLAIM"
                        else if (eventType == "AA_BANK_SETTLEMENT" || type == "AA_BANK_SETTLEMENT") "SETTLEMENT"
                        else if (eventType == "DEDUCTION" || type == "DEDUCTION") "DEDUCTION"
                        else "ORDER_EVENT",
    val category: String = if (role == "PAYOUT_CLAIM") "PAYOUT"
                           else if (role == "DEDUCTION") "DEDUCTION"
                           else if (role == "SETTLEMENT") "SETTLEMENT"
                           else "EARNING",
    val amount: Double,
    val currency: String = "INR",
    val timestamp: Long = System.currentTimeMillis(),
    val reference: String = "",
    val previousHash: String,
    val integrityHash: String,
    val syncStatus: String = "UNSYNCED",
    val rawMetadata: String = "{}"
) {
    fun toCanonicalMap(): Map<String, Any?> {
        return mapOf(
            "id" to id,
            "workerId" to workerId,
            "source" to source,
            "type" to type,
            "eventType" to eventType,
            "role" to role,
            "category" to category,
            "platform" to platform,
            "amount" to amount,
            "currency" to currency,
            "timestamp" to timestamp,
            "reference" to reference,
            "previousHash" to previousHash,
            "integrityHash" to integrityHash,
            "syncStatus" to syncStatus,
            "rawMetadata" to rawMetadata
        )
    }
}

interface EvidenceRepository {
    fun saveEvidence(record: EvidenceRecord)
    fun getAllEvidence(): List<EvidenceRecord>
    fun getEvidenceById(id: String): EvidenceRecord?
    fun getUnsyncedEvidence(): List<EvidenceRecord>
    fun markSyncing(id: String)
    fun markSynced(id: String)
    fun markSynced(ids: List<String>)
    fun clearVault()
    fun verifyIntegrity(): HashChainValidationResult
}
