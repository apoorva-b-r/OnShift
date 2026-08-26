package com.onshift.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.onshift.app.data.model.LiveSchemeRecommendation
import com.onshift.app.data.repository.SchemeWebSocketRepository
import com.onshift.app.data.repository.SchemeWsEvent
import com.onshift.app.ui.common.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class GovernmentSchemesViewModel(
    private val repository: SchemeWebSocketRepository = SchemeWebSocketRepository()
) : ViewModel() {

    private val _uiState = MutableStateFlow<UiState<List<LiveSchemeRecommendation>>>(UiState.Loading)
    val uiState: StateFlow<UiState<List<LiveSchemeRecommendation>>> = _uiState.asStateFlow()

    private val _streamingReasons = MutableStateFlow<Map<String, String>>(emptyMap())
    val streamingReasons: StateFlow<Map<String, String>> = _streamingReasons.asStateFlow()

    private val _engineSource = MutableStateFlow("DETERMINISTIC_FALLBACK")
    val engineSource: StateFlow<String> = _engineSource.asStateFlow()

    private var previousSuccessData: List<LiveSchemeRecommendation>? = null

    companion object {
        val defaultWorkerProfile: Map<String, Any> = mapOf(
            "monthlyIncome" to 29500,
            "workerCategory" to "Delivery Partner",
            "location" to "Maharashtra",
            "verificationLevel" to "FINANCIALLY_CORROBORATED"
        )

        val fallbackRecommendations = listOf(
            LiveSchemeRecommendation(
                schemeId = "pm-svanidhi",
                schemeName = "PM-SVANidhi",
                description = "Micro-credit for street vendors and gig workers",
                relevance = "HIGH",
                matchReason = "Verified monthly income of ₹29,500 and delivery partner status qualify for working capital loan with interest subsidy.",
                benefits = listOf("Collateral-free loan up to ₹10,000", "Interest subsidy @ 7% per annum", "Digital transaction cashback"),
                applicationUrl = "https://pmsvanidhi.mohua.gov.in/",
                explanationSource = "DETERMINISTIC_FALLBACK"
            ),
            LiveSchemeRecommendation(
                schemeId = "ayushman-bharat",
                schemeName = "Ayushman Bharat PM-JAY",
                description = "Health insurance for low income workers",
                relevance = "HIGH",
                matchReason = "Income below state threshold and gig worker category eligible for ₹5 Lakh health cover per family per year.",
                benefits = listOf("Free secondary and tertiary care hospitalization", "Cover up to ₹5 Lakh per family per year", "Cashless access at empanelled hospitals"),
                applicationUrl = "https://pmjay.gov.in/",
                explanationSource = "DETERMINISTIC_FALLBACK"
            ),
            LiveSchemeRecommendation(
                schemeId = "e-shram",
                schemeName = "e-Shram Benefits",
                description = "Social security for unorganized workers",
                relevance = "MEDIUM",
                matchReason = "Registered delivery partner in Maharashtra eligible for e-Shram social security card and accidental insurance.",
                benefits = listOf("Accidental death / disability insurance up to ₹2 Lakh", "Universal Account Number (UAN) for social security", "Integration with central social welfare schemes"),
                applicationUrl = "https://eshram.gov.in/",
                explanationSource = "DETERMINISTIC_FALLBACK"
            )
        )
    }

    fun fetchRecommendations(workerProfile: Map<String, Any> = defaultWorkerProfile) {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            _streamingReasons.value = emptyMap()

            repository.getRecommendationsStream(workerProfile).collect { event ->
                when (event) {
                    is SchemeWsEvent.Connecting -> {
                        _uiState.value = UiState.Loading
                    }

                    is SchemeWsEvent.Chunk -> {
                        val currentMap = _streamingReasons.value.toMutableMap()
                        val currentText = currentMap[event.schemeId] ?: ""
                        currentMap[event.schemeId] = currentText + event.text
                        _streamingReasons.value = currentMap
                    }

                    is SchemeWsEvent.Complete -> {
                        _engineSource.value = event.engineSource
                        _uiState.value = UiState.Success(event.recommendations)
                        previousSuccessData = event.recommendations
                    }

                    is SchemeWsEvent.Error -> {
                        if (previousSuccessData != null) {
                            // Keep displaying previous success data
                            _uiState.value = UiState.Success(previousSuccessData!!)
                        } else {
                            // Fallback to mock recommendations so worker screen never breaks
                            _uiState.value = UiState.Success(fallbackRecommendations)
                            previousSuccessData = fallbackRecommendations
                        }
                    }
                }
            }
        }
    }
}
