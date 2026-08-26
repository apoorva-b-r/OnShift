package com.onshift.app.data.aa

data class AAConsentRequest(
    val workerId: String,
    val aaHandle: String,
    val fiTypes: List<String> = listOf("DEPOSIT", "TRANSACTIONS"),
    val dateRange: String
)

data class AAConsentResponse(
    val consentId: String,
    val status: String,
    val authorizationUrl: String
)

data class AATransaction(
    val transactionId: String,
    val bankName: String,
    val amount: Double,
    val date: String,
    val narration: String
)

interface AccountAggregatorProvider {
    fun requestConsent(request: AAConsentRequest): AAConsentResponse
    fun fetchFinancialData(consentId: String): List<AATransaction>
    fun revokeConsent(consentId: String): Boolean
}
