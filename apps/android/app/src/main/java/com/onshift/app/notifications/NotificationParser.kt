package com.onshift.app.notifications

interface NotificationParser {
    fun parse(title: String, body: String, notificationId: String, workerId: String): NormalizedEvidence?
}