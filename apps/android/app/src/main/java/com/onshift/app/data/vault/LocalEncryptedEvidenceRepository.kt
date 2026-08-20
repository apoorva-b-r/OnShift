package com.onshift.app.data.vault

class LocalEncryptedEvidenceRepository : EvidenceRepository {
    private val memoryStore = mutableListOf<EvidenceRecord>()

    override fun saveEvidence(record: EvidenceRecord) {
        memoryStore.add(record)
    }

    override fun getAllEvidence(): List<EvidenceRecord> {
        return memoryStore.toList()
    }

    override fun getEvidenceById(id: String): EvidenceRecord? {
        return memoryStore.find { it.id == id }
    }

    override fun clearVault() {
        memoryStore.clear()
    }
}
