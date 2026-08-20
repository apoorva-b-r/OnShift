package com.onshift.app.data.vault

data class EvidenceRecord(
    val id: String,
    val workerId: String,
    val source: String,
    val platform: String,
    val amount: Double,
    val timestamp: Long,
    val previousHash: String,
    val integrityHash: String
)

interface EvidenceRepository {
    fun saveEvidence(record: EvidenceRecord)
    fun getAllEvidence(): List<EvidenceRecord>
    fun getEvidenceById(id: String): EvidenceRecord?
    fun clearVault()
}
