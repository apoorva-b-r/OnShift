package com.onshift.app.data.model

data class Evidence(
    val id: String,
    val source: String,
    val type: EvidenceType,
    val timestamp: String,
    val amount: Double?
)
