package com.onshift.app.notifications

import com.google.gson.Gson
import com.google.gson.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.JUnit4

@RunWith(JUnit4::class)
class NotificationParserTest {

    private val workerId = "OS-DEMO-001"
    private val gson = Gson()

    private fun loadFixtureJson(path: String): JsonObject {
        val stream = javaClass.getResourceAsStream(path)
            ?: error("Fixture file not found: $path")
        val jsonText = stream.bufferedReader().use { it.readText() }
        return gson.fromJson(jsonText, JsonObject::class.java)
    }

    @Test
    fun testZomatoFixtureJsonParsing() {
        val json = loadFixtureJson("/fixtures/notifications/zomato/order_completed.json")
        val pkg = json.get("packageName").asString
        val title = json.get("title").asString
        val text = json.get("text").asString
        val notifId = json.get("notificationId").asString

        val parser = PlatformRegistry.getParserForPackage(pkg, "$title $text")
        assertTrue(parser is ZomatoParser)

        val evidence = parser.parse(title, text, notifId, workerId)
        assertNotNull(evidence)
        assertEquals("ORDER_COMPLETED", evidence?.type)
        assertEquals("EARNING", evidence?.category)
        assertEquals("ZOMATO", evidence?.platform)
        assertEquals(420.0, evidence?.amount ?: 0.0, 0.01)
        assertEquals("8841", evidence?.reference)
        assertEquals(workerId, evidence?.workerId)
        assertEquals(notifId, evidence?.metadata?.rawNotificationId)
    }

    @Test
    fun testSwiggyFixtureJsonParsing() {
        val json = loadFixtureJson("/fixtures/notifications/swiggy/order_completed.json")
        val pkg = json.get("packageName").asString
        val title = json.get("title").asString
        val text = json.get("text").asString
        val notifId = json.get("notificationId").asString

        val parser = PlatformRegistry.getParserForPackage(pkg, "$title $text")
        assertTrue(parser is SwiggyParser)

        val evidence = parser.parse(title, text, notifId, workerId)
        assertNotNull(evidence)
        assertEquals("ORDER_COMPLETED", evidence?.type)
        assertEquals("EARNING", evidence?.category)
        assertEquals("SWIGGY", evidence?.platform)
        assertEquals(312.0, evidence?.amount ?: 0.0, 0.01)
        assertEquals("SW-998", evidence?.reference)
        assertEquals(workerId, evidence?.workerId)
        assertEquals(notifId, evidence?.metadata?.rawNotificationId)
    }

    @Test
    fun testUberFixtureJsonParsing() {
        val json = loadFixtureJson("/fixtures/notifications/uber/trip_completed.json")
        val pkg = json.get("packageName").asString
        val title = json.get("title").asString
        val text = json.get("text").asString
        val notifId = json.get("notificationId").asString

        val parser = PlatformRegistry.getParserForPackage(pkg, "$title $text")
        assertTrue(parser is UberParser)

        val evidence = parser.parse(title, text, notifId, workerId)
        assertNotNull(evidence)
        assertEquals("ORDER_COMPLETED", evidence?.type)
        assertEquals("EARNING", evidence?.category)
        assertEquals("UBER", evidence?.platform)
        assertEquals(540.50, evidence?.amount ?: 0.0, 0.01)
        assertEquals("UBR-3321", evidence?.reference)
        assertEquals(workerId, evidence?.workerId)
        assertEquals(notifId, evidence?.metadata?.rawNotificationId)
    }

    @Test
    fun testZomatoHappyPathOrderCompleted() {
        val parser = ZomatoParser()
        val title = "Order Delivered"
        val body = "Order #ZMT4821 completed. You earned ₹500.00"
        val notificationId = "notif-zmt-001"

        val evidence = parser.parse(title, body, notificationId, workerId)

        assertNotNull(evidence)
        assertEquals("ORDER_COMPLETED", evidence?.type)
        assertEquals("EARNING", evidence?.category)
        assertEquals("ZOMATO", evidence?.platform)
        assertEquals(500.0, evidence?.amount ?: 0.0, 0.01)
        assertEquals("4821", evidence?.reference)
        assertEquals(workerId, evidence?.workerId)
    }

    @Test
    fun testZomatoPayoutCompleted() {
        val parser = ZomatoParser()
        val title = "Weekly Payout"
        val body = "Zomato payout of Rs. 1200 transferred. Ref: TXN9912"
        val notificationId = "notif-zmt-002"

        val evidence = parser.parse(title, body, notificationId, workerId)

        assertNotNull(evidence)
        assertEquals("PAYOUT_COMPLETED", evidence?.type)
        assertEquals("PAYOUT", evidence?.category)
        assertEquals("ZOMATO", evidence?.platform)
        assertEquals(1200.0, evidence?.amount ?: 0.0, 0.01)
        assertEquals("TXN9912", evidence?.reference)
    }

    @Test
    fun testSwiggyParsing() {
        val parser = SwiggyParser()
        val title = "Delivery Completed"
        val body = "Order #SW-998 delivered. Earnings: ₹320"
        val notificationId = "notif-swg-001"

        val evidence = parser.parse(title, body, notificationId, workerId)

        assertNotNull(evidence)
        assertEquals("ORDER_COMPLETED", evidence?.type)
        assertEquals("EARNING", evidence?.category)
        assertEquals("SWIGGY", evidence?.platform)
        assertEquals(320.0, evidence?.amount ?: 0.0, 0.01)
        assertEquals("SW-998", evidence?.reference)
    }

    @Test
    fun testUberParsing() {
        val parser = UberParser()
        val title = "Trip Finished"
        val body = "Trip #UBR771 completed. Fare: INR 450.50"
        val notificationId = "notif-ubr-001"

        val evidence = parser.parse(title, body, notificationId, workerId)

        assertNotNull(evidence)
        assertEquals("ORDER_COMPLETED", evidence?.type)
        assertEquals("EARNING", evidence?.category)
        assertEquals("UBER", evidence?.platform)
        assertEquals(450.50, evidence?.amount ?: 0.0, 0.01)
        assertEquals("UBR771", evidence?.reference)
    }

    @Test
    fun testPlatformRegistryRouting() {
        val zomatoParser = PlatformRegistry.getParserForPackage("com.application.zomato", "New order")
        assertTrue(zomatoParser is ZomatoParser)

        val swiggyParser = PlatformRegistry.getParserForPackage("in.swiggy.android", "Order")
        assertTrue(swiggyParser is SwiggyParser)

        val uberParser = PlatformRegistry.getParserForPackage("com.ubercab.driver", "Trip")
        assertTrue(uberParser is UberParser)

        val genericParser = PlatformRegistry.getParserForPackage("com.random.app", "Payment of 100")
        assertTrue(genericParser is GenericParser)
    }

    @Test
    fun testMalformedAndEdgeCaseNotifications() {
        val parser = SwiggyParser()

        // Empty body -> missing amount -> returns null
        val nullResultEmpty = parser.parse("Swiggy", "", "n-001", workerId)
        assertNull(nullResultEmpty)

        // Text without amount -> returns null
        val nullResultNoAmount = parser.parse("Swiggy", "Delivery #123 completed successfully!", "n-002", workerId)
        assertNull(nullResultNoAmount)

        // Unsupported package routing -> falls back to GenericParser
        val fallbackParser = PlatformRegistry.getParserForPackage("com.unknown.app", "You received ₹150 for shift")
        assertTrue(fallbackParser is GenericParser)
        val genericResult = fallbackParser.parse("Payment", "You received ₹150 for shift", "n-003", workerId)
        assertNotNull(genericResult)
        assertEquals("GENERIC", genericResult?.platform)
        assertEquals(150.0, genericResult?.amount ?: 0.0, 0.01)
    }
}