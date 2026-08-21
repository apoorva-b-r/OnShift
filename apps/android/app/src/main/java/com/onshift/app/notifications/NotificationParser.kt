package com.onshift.app.notifications

interface NotificationParser {
    fun canParse(notification: RawNotification): Boolean
    fun parse(notification: RawNotification): ParseResult
}