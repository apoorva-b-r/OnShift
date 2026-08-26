package com.onshift.app.notifications

object PlatformRegistry {
    // TODO: verify real package name against production APK
    const val ZOMATO_PACKAGE = "com.zomato.delivery"
    // TODO: verify real package name against production APK
    const val SWIGGY_PACKAGE = "com.swiggy.deliveryapp"
    // TODO: verify real package name against production APK
    const val UBER_PACKAGE = "com.ubercab.driver"
    // TODO: verify real package name against production APK
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

    /**
     * Routes only packages which have already passed the per-worker allowlist boundary.
     * Unlike [getParserForPackage], this method never examines notification content.
     */
    fun getParserForAllowedPackage(packageName: String): NotificationParser = when (packageName) {
        ZOMATO_PACKAGE -> zomatoParser
        SWIGGY_PACKAGE -> swiggyParser
        UBER_PACKAGE -> uberParser
        BLINKIT_PACKAGE -> genericParser
        else -> genericParser
    }
}
