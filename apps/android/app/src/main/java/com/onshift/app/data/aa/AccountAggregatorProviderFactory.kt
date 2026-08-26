package com.onshift.app.data.aa

/**
 * AccountAggregatorProviderFactory selects BackendAccountAggregatorProvider
 * to route all consent requests and data fetching to the real OnShift backend API.
 */
data class AccountAggregatorProviderSelection(
    val provider: AccountAggregatorProvider,
    val isMock: Boolean
)

fun getAccountAggregatorProvider(): AccountAggregatorProviderSelection =
    AccountAggregatorProviderSelection(BackendAccountAggregatorProvider(), isMock = false)
