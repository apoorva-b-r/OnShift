package com.onshift.app.ui.aa

import com.onshift.app.data.aa.AAConsentRequest
import com.onshift.app.data.aa.AAConsentResponse
import com.onshift.app.data.aa.AATransaction
import com.onshift.app.data.aa.AccountAggregatorProvider
import com.onshift.app.data.aa.AccountAggregatorProviderSelection
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AccountAggregatorViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun mockFlagIsPreservedInSuccessState() = runTest(dispatcher) {
        val provider = object : AccountAggregatorProvider {
            override fun requestConsent(request: AAConsentRequest) =
                AAConsentResponse("fake-consent", "ACTIVE", "https://example.test")

            override fun fetchFinancialData(consentId: String) = listOf(
                AATransaction("account", "txn", 30100.0, "2026-08-08", "SALARY CREDIT")
            )

            override fun revokeConsent(consentId: String) = true
        }
        val viewModel = AccountAggregatorViewModel(AccountAggregatorProviderSelection(provider, isMock = true))

        viewModel.startConsentFlow("OS-TEST", listOf("DEPOSIT"))
        testScheduler.advanceUntilIdle()

        assertTrue(viewModel.uiState.value is AAUiState.Success && (viewModel.uiState.value as AAUiState.Success).isMock)
    }
}
