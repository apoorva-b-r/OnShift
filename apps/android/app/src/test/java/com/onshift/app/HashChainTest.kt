package com.onshift.app

import com.onshift.app.data.hashchain.HashChain
import com.onshift.app.data.vault.EvidenceRecord
import org.junit.Assert.*
import org.junit.Test

class HashChainTest {

    @Test
    fun testHashChainValidSequence() {
        val genesisPrevious = "GENESIS_0000000000000000000000000000000000000000000000000000000000000000"

        val rec1Raw = EvidenceRecord(
            id = "ev-1",
            workerId = "OS-DEMO-001",
            source = "DECLARED",
            platform = "Zomato",
            amount = 18200.0,
            timestamp = 1000L,
            previousHash = genesisPrevious,
            integrityHash = ""
        )
        val rec1Hash = HashChain.calculateRecordHash(rec1Raw, genesisPrevious)
        val rec1 = rec1Raw.copy(integrityHash = rec1Hash)

        val rec2Raw = EvidenceRecord(
            id = "ev-2",
            workerId = "OS-DEMO-001",
            source = "FINANCIAL",
            platform = "HDFC Bank",
            amount = 30100.0,
            timestamp = 2000L,
            previousHash = rec1Hash,
            integrityHash = ""
        )
        val rec2Hash = HashChain.calculateRecordHash(rec2Raw, rec1Hash)
        val rec2 = rec2Raw.copy(integrityHash = rec2Hash)

        val validation = HashChain.verifyHashChain(listOf(rec1, rec2))
        assertTrue(validation.valid)
    }

    @Test
    fun testHashChainTamperDetection() {
        val genesisPrevious = "GENESIS_0000000000000000000000000000000000000000000000000000000000000000"

        val rec1Raw = EvidenceRecord(
            id = "ev-1",
            workerId = "OS-DEMO-001",
            source = "DECLARED",
            platform = "Zomato",
            amount = 18200.0,
            timestamp = 1000L,
            previousHash = genesisPrevious,
            integrityHash = ""
        )
        val rec1Hash = HashChain.calculateRecordHash(rec1Raw, genesisPrevious)
        val rec1 = rec1Raw.copy(integrityHash = rec1Hash)

        // Tamper with record amount after hashing
        val tamperedRec1 = rec1.copy(amount = 99999.0)

        val validation = HashChain.verifyHashChain(listOf(tamperedRec1))
        assertFalse(validation.valid)
        assertEquals("ev-1", validation.brokenAt)
    }
}
