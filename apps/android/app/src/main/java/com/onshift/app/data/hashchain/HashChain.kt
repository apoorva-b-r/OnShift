package com.onshift.app.data.hashchain

import com.onshift.app.data.vault.EvidenceRecord
import java.security.MessageDigest

data class HashChainValidationResult(
    val valid: Boolean,
    val brokenAt: String? = null,
    val reason: String
)

object HashChain {

    fun computeSha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }

    fun calculateRecordHash(record: EvidenceRecord, previousHash: String): String {
        val payload = "${record.id}|${record.workerId}|${record.source}|${record.platform}|${record.amount}|${record.timestamp}|$previousHash"
        return computeSha256(payload)
    }

    fun verifyHashChain(records: List<EvidenceRecord>): HashChainValidationResult {
        if (records.isEmpty()) {
            return HashChainValidationResult(valid = true, reason = "Hash chain is empty.")
        }

        var expectedPreviousHash = "GENESIS_0000000000000000000000000000000000000000000000000000000000000000"

        for (record in records) {
            if (record.previousHash != expectedPreviousHash) {
                return HashChainValidationResult(
                    valid = false,
                    brokenAt = record.id,
                    reason = "Previous hash mismatch at record ${record.id}. Expected $expectedPreviousHash but found ${record.previousHash}."
                )
            }

            val expectedCurrentHash = calculateRecordHash(record, expectedPreviousHash)
            if (record.integrityHash != expectedCurrentHash) {
                return HashChainValidationResult(
                    valid = false,
                    brokenAt = record.id,
                    reason = "Integrity hash failure at record ${record.id}. Content tampered or modified."
                )
            }

            expectedPreviousHash = record.integrityHash
        }

        return HashChainValidationResult(valid = true, reason = "Hash chain integrity verified.")
    }
}
