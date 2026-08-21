package com.onshift.app.data.model

data class UserPreferences(
    val language: String = "en",
    val selectedPlatforms: List<String> = emptyList()
)
