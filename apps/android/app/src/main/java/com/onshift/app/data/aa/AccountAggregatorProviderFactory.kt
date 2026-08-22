package com.onshift.app.data.aa

/**
 * Task 0 finding: this project has no Hilt setup, no existing Android ViewModel factory,
 * and no Android Setu provider. This calling-side factory therefore selects the existing
 * MockAccountAggregatorProvider until a real Android provider is supplied.
 */
data class AccountAggregatorProviderSelection(
    val provider: AccountAggregatorProvider,
    val isMock: Boolean
)

fun getAccountAggregatorProvider(): AccountAggregatorProviderSelection =
    AccountAggregatorProviderSelection(MockAccountAggregatorProvider(), isMock = true)
