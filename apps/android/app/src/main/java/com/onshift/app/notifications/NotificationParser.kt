package com.onshift.app.notifications

data class ParsedNotificationEvidence(
    val platform: String,
    val amount: Double,
    val reference: String,
    val rawSnippet: String,
    val timestamp: Long = System.currentTimeMillis()
)

interface NotificationParser {
    fun canParse(packageName: String, text: String): Boolean
    fun parse(packageName: String, text: String): ParsedNotificationEvidence?
}
