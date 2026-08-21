package com.onshift.app.notifications

object PlatformRegistry {

    private val parsers: List<NotificationParser> = listOf(
        ZomatoParser(),
        SwiggyParser(),
        UberParser()
    )
    private val genericParser = GenericParser()

    fun detectPlatform(packageName: String): Platform {
        return when {
            packageName.contains("zomato", ignoreCase = true) -> Platform.ZOMATO
            packageName.contains("swiggy", ignoreCase = true) -> Platform.SWIGGY
            packageName.contains("uber", ignoreCase = true) -> Platform.UBER
            else -> Platform.UNKNOWN
        }
    }

    fun parse(notification: RawNotification): ParseResult {
        val matchedParser = parsers.firstOrNull { it.canParse(notification) } ?: genericParser
        return matchedParser.parse(notification)
    }
}