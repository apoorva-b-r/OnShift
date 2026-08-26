package com.onshift.app

import com.google.gson.GsonBuilder
import com.onshift.app.data.model.Credential
import com.onshift.app.data.model.VerificationLevel
import com.onshift.app.ui.screens.VERIFIER_URL
import com.onshift.app.ui.screens.shortenUrl
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import java.util.Base64

class CredentialShareTest {

    @Test
    fun testVerifierUrlConstant() {
        assertEquals("https://on-shift-verifier-web-22pj.vercel.app/", VERIFIER_URL)
    }

    @Test
    fun testCredentialJsonSerialization() {
        val credential = Credential(
            workerId = "WORKER-123",
            period = "2026-08",
            verifiedIncome = 45000.0,
            verificationLevel = VerificationLevel.FINANCIALLY_CORROBORATED,
            signaturePreview = "0xABC123",
            includedClaims = listOf("Identity Verified", "Verified Income: ₹45,000")
        )

        val gson = GsonBuilder().setPrettyPrinting().create()
        val jsonString = gson.toJson(credential)

        assertTrue(jsonString.contains("\"workerId\": \"WORKER-123\""))
        assertTrue(jsonString.contains("\"verifiedIncome\": 45000.0"))
        assertTrue(jsonString.contains("\"includedClaims\": ["))
        assertTrue(jsonString.contains("Identity Verified"))
    }

    @Test
    fun testFilteredCredentialSerializationOmitsUnselectedFields() {
        val credential = Credential(
            workerId = "WORKER-456",
            period = "2026-08",
            verifiedIncome = 30100.0,
            verificationLevel = VerificationLevel.FINANCIALLY_CORROBORATED,
            signaturePreview = "0xDEF456",
            includedClaims = listOf("Verified Income: ₹30,100")
        )

        val filteredCredential = credential.copy(
            verifiedIncome = null,
            verificationLevel = null,
            includedClaims = listOf("Identity Verified")
        )

        val gson = GsonBuilder().setPrettyPrinting().create()
        val jsonString = gson.toJson(filteredCredential)

        assertTrue(jsonString.contains("\"workerId\": \"WORKER-456\""))
        assertFalse(jsonString.contains("verifiedIncome"))
        assertFalse(jsonString.contains("verificationLevel"))
        assertTrue(jsonString.contains("Identity Verified"))
    }

    @Test
    fun testUrlSafeBase64EncodingForLinkData() {
        val credential = Credential(
            workerId = "WORKER-789",
            period = "2026-08",
            verifiedIncome = 50000.0,
            verificationLevel = VerificationLevel.FINANCIALLY_CORROBORATED,
            signaturePreview = "0x789",
            includedClaims = listOf("Identity Verified", "Verified Income")
        )

        val gson = GsonBuilder().setPrettyPrinting().create()
        val jsonString = gson.toJson(credential)
        val encodedBytes = Base64.getUrlEncoder().withoutPadding().encode(jsonString.toByteArray(Charsets.UTF_8))
        val encodedStr = String(encodedBytes, Charsets.UTF_8)
        val fullLink = "${VERIFIER_URL}?data=${encodedStr}"

        assertTrue(fullLink.startsWith("https://on-shift-verifier-web-22pj.vercel.app/?data="))

        // Test decoding back
        val decodedBytes = Base64.getUrlDecoder().decode(encodedStr)
        val decodedJson = String(decodedBytes, Charsets.UTF_8)
        assertTrue(decodedJson.contains("WORKER-789"))
        assertTrue(decodedJson.contains("50000.0"))
    }

    @Test
    fun testShortenUrlFallbackOnInvalidUrl() = runBlocking {
        val dummyUrl = "invalid-url-for-shortener"
        val result = shortenUrl(dummyUrl)
        assertEquals(dummyUrl, result)
    }
}
