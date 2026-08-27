package com.onshift.app.ui.aa

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.onshift.app.data.aa.AAConsentRequest
import com.onshift.app.data.aa.AAConsentResponse
import com.onshift.app.data.aa.AccountAggregatorProvider
import com.onshift.app.data.aa.AccountAggregatorProviderSelection
import com.onshift.app.data.aa.getAccountAggregatorProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed interface AAUiState {
    data object Idle : AAUiState
    data object RequestingConsent : AAUiState
    data class AwaitingApproval(val redirectUrl: String) : AAUiState
    data object FetchingData : AAUiState
    data class Success(val transactions: List<com.onshift.app.data.aa.AATransaction>, val isMock: Boolean) : AAUiState
    data class Error(val message: String) : AAUiState
}

/**
 * Task 0 finding: the app uses plain Compose screens and has no Hilt or existing ViewModels.
 * This ViewModel follows the manual provider injection decision and keeps provider selection
 * outside the UI state logic. The Home button reaches this screen and LaunchedEffect starts
 * startConsentFlow() on entry.
 */
class AccountAggregatorViewModel(
    private val selection: AccountAggregatorProviderSelection = getAccountAggregatorProvider()
) : ViewModel() {
    private val provider: AccountAggregatorProvider = selection.provider
    private val _uiState = MutableStateFlow<AAUiState>(AAUiState.Idle)
    val uiState: StateFlow<AAUiState> = _uiState.asStateFlow()
    private var lastCustomerId = "OS-DEMO-001"
    private var lastFiTypes = listOf("DEPOSIT", "TRANSACTIONS")
    private var activeConsent: AAConsentResponse? = null

    fun startConsentFlow(customerId: String, fiTypes: List<String>) {
        lastCustomerId = customerId
        lastFiTypes = fiTypes
        viewModelScope.launch {
            _uiState.value = AAUiState.RequestingConsent
            try {
                var consent = activeConsent
                if (consent == null) {
                    consent = withContext(Dispatchers.IO) {
                        provider.requestConsent(AAConsentRequest(customerId, "OnShift income verification", fiTypes, "2026-08-01/2026-08-31"))
                    }
                    activeConsent = consent
                }

                if (consent.status != "ACTIVE" && !selection.isMock) {
                    if (consent.authorizationUrl.isBlank() || (!consent.authorizationUrl.startsWith("http://") && !consent.authorizationUrl.startsWith("https://"))) {
                        _uiState.value = AAUiState.Error("Backend returned an invalid or missing consent authorization URL.")
                        return@launch
                    }
                    try {
                        _uiState.value = AAUiState.FetchingData
                        val transactions = withContext(Dispatchers.IO) { provider.fetchFinancialData(consent.consentId) }
                        withContext(Dispatchers.IO) {
                            try { com.onshift.app.data.api.BackendApiClient.runVerificationSync(customerId) } catch (_: Exception) {}
                        }
                        _uiState.value = AAUiState.Success(transactions, selection.isMock)
                        return@launch
                    } catch (_: Exception) {
                        _uiState.value = AAUiState.AwaitingApproval(consent.authorizationUrl)
                        return@launch
                    }
                }

                _uiState.value = AAUiState.FetchingData
                val transactions = withContext(Dispatchers.IO) { provider.fetchFinancialData(consent.consentId) }
                withContext(Dispatchers.IO) {
                    try { com.onshift.app.data.api.BackendApiClient.runVerificationSync(customerId) } catch (_: Exception) {}
                }
                _uiState.value = AAUiState.Success(transactions, selection.isMock)
            } catch (error: Exception) {
                _uiState.value = AAUiState.Error(error.message ?: "Account Aggregator is unavailable.")
            }
        }
    }

    fun retry() {
        viewModelScope.launch {
            val consent = activeConsent
            if (consent != null) {
                _uiState.value = AAUiState.FetchingData
                try {
                    val transactions = withContext(Dispatchers.IO) { provider.fetchFinancialData(consent.consentId) }
                    withContext(Dispatchers.IO) {
                        try { com.onshift.app.data.api.BackendApiClient.runVerificationSync(lastCustomerId) } catch (_: Exception) {}
                    }
                    _uiState.value = AAUiState.Success(transactions, selection.isMock)
                    return@launch
                } catch (_: Exception) {
                    _uiState.value = AAUiState.AwaitingApproval(consent.authorizationUrl)
                    return@launch
                }
            }
            startConsentFlow(lastCustomerId, lastFiTypes)
        }
    }
}
