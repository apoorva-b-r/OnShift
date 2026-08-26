package com.onshift.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class ShiftEvidenceItem(
    val platform: String,
    val amount: Double,
    val timestamp: String,
    val isVerified: Boolean = true
)

object VaultStore {
    private val _shifts = MutableStateFlow(
        listOf(
            ShiftEvidenceItem("Zomato", 140.0, "Just now", true),
            ShiftEvidenceItem("Swiggy", 95.0, "1 hr ago", true),
            ShiftEvidenceItem("Blinkit", 60.0, "3 hrs ago", true)
        )
    )
    val shifts: StateFlow<List<ShiftEvidenceItem>> = _shifts.asStateFlow()

    fun addShift(shift: ShiftEvidenceItem) {
        _shifts.value = listOf(shift) + _shifts.value
    }
}