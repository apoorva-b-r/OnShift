package com.onshift.app.data.model

data class UserPreferences(
    val language: String = "en",
    val selectedPlatforms: List<String> = emptyList(),
    val onboardingCompleted: Boolean = false,
    val lastBackedUpAt: Long? = null,
    val fullName: String = "Vikram Malhotra",
    val phoneNumber: String = "+91 98765 43210",
    val dateOfBirth: String = "1995-08-15",
    val gender: String = "Male",
    val state: String = "Maharashtra",
    val city: String = "Mumbai",
    val email: String = "vikram.malhotra@example.com",
    val isLoggedIn: Boolean = false,
    val passwordHash: String = "",
    val workerId: String = "OS-DEMO-001"
)



