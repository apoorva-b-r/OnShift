package com.onshift.app

import com.onshift.app.notifications.*
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.JUnit4
import java.security.MessageDigest

@RunWith(JUnit4::class)
class LiveDemoTest {

    @Test
    fun testNormalizationAndDistinctCategoryAssignment() {
        val parser = ZomatoParser()

        // 1. Test Earning Notification
        val earning = parser.parse(
            title = "Order Delivered",
            body = "Order #ZMT4821 completed. You earned ₹500.00",
            notificationId = "notif-001",
            workerId = "OS-DEMO-001"
        )
        assertNotNull(earning)
        assertEquals("ORDER_COMPLETED", earning?.type)
        assertEquals("EARNING", earning?.category)
        assertEquals(500.0, earning?.amount ?: 0.0, 0.01)
        assertEquals("ZMT4821", earning?.reference)

        // 2. Test Payout Notification
        val payout = parser.parse(
            title = "Weekly Payout",
            body = "Zomato payout of Rs. 1200 transferred. Ref: TXN9912",
            notificationId = "notif-002",
            workerId = "OS-DEMO-001"
        )
        assertNotNull(payout)
        assertEquals("PAYOUT_COMPLETED", payout?.type)
        assertEquals("PAYOUT", payout?.category)
        assertEquals(1200.0, payout?.amount ?: 0.0, 0.01)
        assertEquals("TXN9912", payout?.reference)
    }

    @Test
    fun testHashChainLinkageAndTamperDetection() {
        val parser = ZomatoParser()
        val item1 = parser.parse("Order", "Order #ZMT1 completed ₹500", "n1", "OS-DEMO-001")
        val item2 = parser.parse("Order", "Order #ZMT2 completed ₹700", "n2", "OS-DEMO-001")

        assertNotNull(item1)
        assertNotNull(item2)

        val genesisHash = "0000000000000000000000000000000000000000000000000000000000000000"
        val hash1 = item1!!.computeIntegrityHash(genesisHash)
        val hash2 = item2!!.computeIntegrityHash(hash1)

        assertEquals(hash1, item2.previousHash)
        assertNotNull(item2.integrityHash)

        // Tamper test
        val tamperedAmount = 9999.0
        val tamperedPayload = "${item1.id}|${item1.workerId}|${item1.source}|${item1.type}|${item1.category}|${item1.platform}|${item1.timestamp}|$tamperedAmount|${item1.reference}|${item1.previousHash}"
        val recalculatedHash = MessageDigest.getInstance("SHA-256")
            .digest(tamperedPayload.toByteArray())
            .joinToString("") { "%02x".format(it) }

        assertNotEquals(item1.integrityHash, recalculatedHash)
    }
}