package com.onshift.app.notifications

object PlatformRegistry {
    private val zomatoParser = ZomatoParser()
    private val swiggyParser = SwiggyParser()
    private val uberParser = UberParser()
    private val genericParser = GenericParser()

    fun getParserForPackage(packageName: String, textContent: String): NotificationParser {
        return when {
            packageName.contains("zomato", ignoreCase = true) || textContent.contains("zomato", ignoreCase = true) -> zomatoParser
            packageName.contains("swiggy", ignoreCase = true) || textContent.contains("swiggy", ignoreCase = true) -> swiggyParser
            packageName.contains("uber", ignoreCase = true) || textContent.contains("uber", ignoreCase = true) -> uberParser
            else -> genericParser
        }
    }
}