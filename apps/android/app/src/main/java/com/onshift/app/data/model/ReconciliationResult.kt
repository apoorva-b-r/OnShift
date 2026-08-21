package com.onshift.app.data.model

data class ReconciliationResult(
    val expected: Double,
    val actual: Double,
    val status: ReconciliationStatus,
    val differenceAmount: Double,
    val period: String
)
