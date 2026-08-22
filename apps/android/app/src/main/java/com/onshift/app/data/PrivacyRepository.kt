package com.onshift.app.data

import com.onshift.app.data.model.MockData
import com.onshift.app.data.model.PrivacyRecord
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object PrivacyRepository {
    private val _privacyRecordState = MutableStateFlow(MockData.mockPrivacyRecord)
    val privacyRecordState: StateFlow<PrivacyRecord> = _privacyRecordState.asStateFlow()

    fun tamperData() {
        _privacyRecordState.value = _privacyRecordState.value.copy(
            hashChainValid = false
        )
    }

    fun resetHashChain() {
        _privacyRecordState.value = MockData.mockPrivacyRecord
    }
}
