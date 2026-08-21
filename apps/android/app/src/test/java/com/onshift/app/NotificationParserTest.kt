package com.onshift.app

import com.onshift.app.notifications.*
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class NotificationParserTest {

    private val zomatoParser = ZomatoParser()
    private val swiggyParser = SwiggyParser()
    private val uberParser = UberParser()

    @Test
    fun testZomatoHappyPathOrderCompleted() {
        val raw = RawNotification(
            packageName = "com.application.zomato",
            title = "Zomato",
            text = "Order #ZMT4821 completed. Earnings ₹245",
            timestamp = Instant.now(),
            notificationId = "demo-001"
        )

        assertTrue(zomatoParser.canParse(raw))
        val result = zomatoParser.parse(raw)

        assertTrue(result.success)
        assertNotNull(result.evidence)
        assertEquals(Platform.ZOMATO, result.evidence?.platform)
        assertEquals(EventType.ORDER_COMPLETED, result.evidence?.eventType)
        assertEquals(245.0, result.evidence?.amount)
        assertEquals("ZMT4821", result.evidence?.orderId)
        assertEquals(ExtractionConfidence.HIGH, result.extractionConfidence)
    }

    @Test
    fun testSwiggyHappyPathDelivery() {
        val raw = RawNotification(
            packageName = "in.swiggy.android",
            title = "Swiggy",
            text = "Delivery completed. You earned ₹312.50 for Order #SW-998",
            timestamp = Instant.now(),
            notificationId = "demo-002"
        )

        assertTrue(swiggyParser.canParse(raw))
        val result = swiggyParser.parse(raw)

        assertTrue(result.success)
        assertNotNull(result.evidence)
        assertEquals(Platform.SWIGGY, result.evidence?.platform)
        assertEquals(EventType.ORDER_COMPLETED, result.evidence?.eventType)
        assertEquals(312.50, result.evidence?.amount)
        assertEquals("SW-998", result.evidence?.orderId)
        assertEquals(ExtractionConfidence.HIGH, result.extractionConfidence)
    }

    @Test
    fun testUberHappyPathTrip() {
        val raw = RawNotification(
            packageName = "com.ubercab.driver",
            title = "Uber",
            text = "Trip #UBR771 completed. You earned ₹180",
            timestamp = Instant.now(),
            notificationId = "demo-003"
        )

        assertTrue(uberParser.canParse(raw))
        val result = uberParser.parse(raw)

        assertTrue(result.success)
        assertNotNull(result.evidence)
        assertEquals(Platform.UBER, result.evidence?.platform)
        assertEquals(EventType.TRIP_COMPLETED, result.evidence?.eventType)
        assertEquals(180.0, result.evidence?.amount)
        assertEquals("UBR771", result.evidence?.orderId)
        assertEquals(ExtractionConfidence.HIGH, result.extractionConfidence)
    }

    @Test
    fun testMissingAmountHandledGracefully() {
        val raw = RawNotification(
            packageName = "com.application.zomato",
            title = "Zomato",
            text = "Order #ZMT4821 completed. Safe driving!",
            timestamp = Instant.now()
        )

        val result = zomatoParser.parse(raw)
        assertTrue(result.success)
        assertNull(result.evidence?.amount)
        assertTrue(result.warnings.contains("AMOUNT_MISSING"))
    }

    @Test
    fun testAmbiguousAmountsFlagged() {
        val raw = RawNotification(
            packageName = "com.application.zomato",
            title = "Zomato",
            text = "Order completed. Earnings ₹245. Bonus ₹50 pending.",
            timestamp = Instant.now()
        )

        val result = zomatoParser.parse(raw)
        assertTrue(result.success)
        assertNull(result.evidence?.amount)
        assertTrue(result.warnings.contains("AMOUNT_AMBIGUOUS"))
        assertEquals(ExtractionConfidence.LOW, result.extractionConfidence)
    }

    @Test
    fun testPlatformRegistryFallback() {
        val raw = RawNotification(
            packageName = "com.unknown.app",
            title = "Payout alert",
            text = "You received ₹500 today",
            timestamp = Instant.now()
        )

        val result = PlatformRegistry.parse(raw)
        assertTrue(result.success)
        assertEquals(Platform.UNKNOWN, result.evidence?.platform)
        assertEquals(500.0, result.evidence?.amount)
    }
}