package com.onshift.app.notifications

object PlatformRegistry {
    // TODO: verify real package name with each platform before production release.
    const val ZOMATO_PACKAGE = "com.zomato.delivery"
    // TODO: verify real package name with each platform before production release.
    const val SWIGGY_PACKAGE = "com.swiggy.deliveryapp"
    // TODO: verify real package name with Uber before production release.
    const val UBER_PACKAGE = "com.ubercab.driver"
    // TODO: verify Blinkit delivery-partner package name before production release.
    const val BLINKIT_PACKAGE = "com.blinkit.delivery"

    private val zomatoParser = ZomatoParser()
    private val swiggyParser = SwiggyParser()
    private val uberParser = UberParser()
    private val genericParser = GenericParser()

    fun allowedPackages(selectedPlatforms: Collection<String>): Set<String> =
        selectedPlatforms.mapNotNull { platform ->
            when (platform.trim().uppercase()) {
                "ZOMATO" -> ZOMATO_PACKAGE
                "SWIGGY" -> SWIGGY_PACKAGE
                "UBER" -> UBER_PACKAGE
                "BLINKIT" -> BLINKIT_PACKAGE
                else -> null
            }
        }.toSet()

    fun getParserForPackage(packageName: String, textContent: String): NotificationParser {
        return when {
            packageName.contains("zomato", ignoreCase = true) || textContent.contains("zomato", ignoreCase = true) -> zomatoParser
            packageName.contains("swiggy", ignoreCase = true) || textContent.contains("swiggy", ignoreCase = true) -> swiggyParser
            packageName.contains("uber", ignoreCase = true) || textContent.contains("uber", ignoreCase = true) -> uberParser
            // Blinkit uses GenericParser until its dedicated P1 parser is implemented.
            packageName == BLINKIT_PACKAGE || textContent.contains("blinkit", ignoreCase = true) -> genericParser
            else -> genericParser
        }
    }
}
