package com.onshift.app.notifications

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.JUnit4

@RunWith(JUnit4::class)
class NotificationParserTest {

    private val workerId = "OS-DEMO-001"

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
        assertEquals("ZMT4821", evidence?.reference)
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
}