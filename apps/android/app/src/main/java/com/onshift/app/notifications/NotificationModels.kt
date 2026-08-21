package com.onshift.app.notifications

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import java.security.MessageDigest

data class EvidenceMetadata(
    @SerializedName("rawNotificationId") val rawNotificationId: String,
    @SerializedName("parserVersion") val parserVersion: String = "1.0",
    @SerializedName("title") val title: String? = null
)

data class NormalizedEvidence(
    @SerializedName("id") val id: String,
    @SerializedName("workerId") val workerId: String,
    @SerializedName("source") val source: String = "OBSERVED",
    @SerializedName("type") val type: String,               // ORDER_COMPLETED | EARNING_RECORDED | PAYOUT_COMPLETED
    @SerializedName("category") val category: String,       // EARNING | PAYOUT
    @SerializedName("platform") val platform: String,       // ZOMATO | SWIGGY | UBER | GENERIC
    @SerializedName("timestamp") val timestamp: String,      // ISO-8601 UTC
    @SerializedName("amount") val amount: Double,
    @SerializedName("reference") val reference: String,
    @SerializedName("metadata") val metadata: EvidenceMetadata,
    @SerializedName("previousHash") var previousHash: String? = null,
    @SerializedName("integrityHash") var integrityHash: String? = null
) {
    fun computeIntegrityHash(prevHash: String): String {
        this.previousHash = prevHash
        val canonicalPayload = "$id|$workerId|$source|$type|$category|$platform|$timestamp|$amount|$reference|$prevHash"
        val digest = MessageDigest.getInstance("SHA-256").digest(canonicalPayload.toByteArray(Charsets.UTF_8))
        val computed = digest.joinToString("") { "%02x".format(it) }
        this.integrityHash = computed
        return computed
    }

    fun toJson(): String {
        return Gson().toJson(this)
    }

    companion object {
        fun fromJson(json: String): NormalizedEvidence {
            return Gson().fromJson(json, NormalizedEvidence::class.java)
        }
    }
}