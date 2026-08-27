package com.onshift.app.data.model

data class Credential(
    val type: String = "OnShiftIncomeCredential",
    val workerId: String,
    val issuer: String = "OnShift Proof Authority",
    val issuedAt: String = "",
    val validUntil: String = "",
    val period: String = "01 Aug to 07 Aug 2026",
    val verifiedIncome: Double? = 30100.0,
    val verificationLevel: VerificationLevel? = VerificationLevel.FINANCIALLY_CORROBORATED,
    val signaturePreview: String? = null,
    val signature: String? = null,
    val publicKeyHex: String? = null,
    val verificationId: String? = null,
    val includedClaims: List<String> = emptyList(),
    val claims: Map<String, Any?>? = null
)
