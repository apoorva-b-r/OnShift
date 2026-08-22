package com.onshift.app.data.model

data class LiveSchemeRecommendation(
    val schemeId: String,
    val schemeName: String,
    val description: String,
    val relevance: String,
    val matchReason: String,
    val benefits: List<String>,
    val applicationUrl: String,
    val explanationSource: String
)
