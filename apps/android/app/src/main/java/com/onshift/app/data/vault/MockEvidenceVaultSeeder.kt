package com.onshift.app.data.vault

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import java.io.InputStreamReader

data class MockEvidenceVaultJson(
    val version: String = "1.0",
    val workerId: String = "sadhana.r@somaiya.edu",
    val sourceProfile: String = "vikram.malhotra@example.com",
    val records: List<EvidenceRecord> = emptyList()
)

object MockEvidenceVaultSeeder {

    private const val TAG = "MOCK_EVIDENCE"
    private const val AUDIT_TAG = "EVIDENCE_AUDIT"
    private val gson = Gson()

    /**
     * DEBUG-only seeding method.
     * Reads mock_evidence_vault.json from assets, parses fixture records,
     * and seeds them THROUGH the existing EvidenceRepository interface
     * into local encrypted persistence idempotently.
     */
    fun seedIfNecessary(context: Context, repository: EvidenceRepository, targetWorkerId: String = "sadhana.r@somaiya.edu"): Int {
        val isDebuggable = (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
        if (!isDebuggable) {
            Log.d(TAG, "Release build detected - skipping mock evidence seeding")
            return 0
        }

        Log.d(TAG, "[MOCK_EVIDENCE] Seed started")
        Log.d(TAG, "[MOCK_EVIDENCE] Worker: $targetWorkerId")

        val fixtureData = loadFixtureFromAssets(context)
        if (fixtureData == null || fixtureData.records.isEmpty()) {
            Log.w(TAG, "[MOCK_EVIDENCE] No fixture records found in assets")
            return 0
        }

        val fixtureRecords = fixtureData.records
        Log.d(TAG, "[MOCK_EVIDENCE] Loaded ${fixtureRecords.size} fixture records")

        var insertedCount = 0
        var skippedCount = 0

        for (record in fixtureRecords) {
            val existing = repository.getEvidenceById(record.id)
            if (existing == null) {
                // Ensure record is correctly associated with worker identity
                val scopedRecord = record.copy(workerId = targetWorkerId)
                repository.saveEvidence(scopedRecord)
                insertedCount++
            } else {
                skippedCount++
            }
        }

        Log.d(TAG, "[MOCK_EVIDENCE] Inserted $insertedCount")
        Log.d(TAG, "[MOCK_EVIDENCE] Skipped $skippedCount existing records")

        val allRepoRecords = repository.getAllEvidence()
        Log.d(AUDIT_TAG, "worker=$targetWorkerId repository=${repository.javaClass.simpleName} records=${allRepoRecords.size} fixtureRecords=${fixtureRecords.size}")

        return insertedCount
    }

    private fun loadFixtureFromAssets(context: Context): MockEvidenceVaultJson? {
        return try {
            val inputStream = context.assets.open("mock_evidence_vault.json")
            InputStreamReader(inputStream, Charsets.UTF_8).use { reader ->
                gson.fromJson(reader, MockEvidenceVaultJson::class.java)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse mock_evidence_vault.json from assets: ${e.message}", e)
            null
        }
    }
}
