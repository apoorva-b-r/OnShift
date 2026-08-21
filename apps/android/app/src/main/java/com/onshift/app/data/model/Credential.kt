package com.onshift.app.data.model

data class Credential(
    val workerId: String,
    val period: String,
    val verifiedIncome: Double?,
    val verificationLevel: VerificationLevel?,
    val signaturePreview: String?,
    val includedClaims: List<String>
)
