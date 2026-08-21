package com.onshift.app.data.model

data class VerificationResult(
    val level: VerificationLevel,
    val confidenceScore: Double,
    val explanation: String
)
