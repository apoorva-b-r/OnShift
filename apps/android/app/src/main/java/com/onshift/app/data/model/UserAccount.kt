package com.onshift.app.data.model

data class UserAccount(
    val email: String,
    val passwordHash: String = "",
    val fullName: String = "Anonymous Worker",
    val phoneNumber: String = "+91 98765 43210",
    val dateOfBirth: String = "1998-05-15",
    val gender: String = "Female",
    val state: String = "Maharashtra",
    val city: String = "Mumbai",
    val workerId: String = "OS-DEMO-001"
)
