package com.onshift.app.data.aa

class MockAccountAggregatorProvider : AccountAggregatorProvider {

    override fun requestConsent(request: AAConsentRequest): AAConsentResponse {
        return AAConsentResponse(
            consentId = "AA-MOCK-CONSENT-9912",
            status = "PENDING_AUTHORIZATION",
            authorizationUrl = "https://aa-sandbox.onshift.org/authorize/AA-MOCK-CONSENT-9912"
        )
    }

    override fun fetchFinancialData(consentId: String): List<AATransaction> {
        return listOf(
            AATransaction(
                transactionId = "TXN-HDFC-994821",
                bankName = "HDFC Bank",
                amount = 30100.0,
                date = "2026-08-08T06:00:00.000Z",
                narration = "NEFT CR-Gig Platform Escrow Private Limited-PAYOUT"
            )
        )
    }

    override fun revokeConsent(consentId: String): Boolean {
        return true
    }
}
