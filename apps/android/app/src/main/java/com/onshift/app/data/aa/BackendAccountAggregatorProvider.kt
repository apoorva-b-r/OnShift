package com.onshift.app.data.aa

import com.onshift.app.data.api.BackendApiClient

class BackendAccountAggregatorProvider : AccountAggregatorProvider {

    override fun requestConsent(request: AAConsentRequest): AAConsentResponse {
        return BackendApiClient.requestConsentSync(request.workerId, request.fiTypes)
    }

    override fun fetchFinancialData(consentId: String): List<AATransaction> {
        val status = BackendApiClient.getConsentStatusSync(consentId)
        return when (status) {
            "ACTIVE" -> {
                BackendApiClient.fetchFinancialDataSync(consentId)
            }
            "PENDING" -> {
                throw Exception("Consent $consentId is still PENDING authorization. Please approve consent in your browser.")
            }
            "EXPIRED" -> {
                throw Exception("Consent request has EXPIRED. Please request a new consent.")
            }
            "REVOKED", "REJECTED" -> {
                throw Exception("Consent was $status by user.")
            }
            else -> {
                throw Exception("Consent status is $status. Cannot fetch financial data.")
            }
        }
    }

    override fun revokeConsent(consentId: String): Boolean {
        return true
    }
}
