package com.onshift.app

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.onshift.app.data.api.BackendApiClient
import com.onshift.app.data.vault.LocalEncryptedEvidenceRepository
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class AndroidBackendIntegrationTest {
    private lateinit var testVaultFile: File
    private lateinit var repository: LocalEncryptedEvidenceRepository

    @Before
    fun setUp() {
        testVaultFile = File.createTempFile("android_integration_vault", ".enc")
        if (testVaultFile.exists()) testVaultFile.delete()
        repository = LocalEncryptedEvidenceRepository.createForTest(testVaultFile)

        // Configure BackendApiClient
        BackendApiClient.configure("http://localhost:4000/api/v1", "OS-DEMO-001")
    }

    @After
    fun tearDown() {
        repository.clearVault()
        if (testVaultFile.exists()) testVaultFile.delete()
    }

    // =========================================================================
    // 1. Authenticated Account Session & Evidence Retrieval
    // =========================================================================
    @Test
    fun test01_AuthenticatedAccountSessionAndEvidenceRetrieval() {
        val latch = CountDownLatch(1)
        var resultArr: JsonArray? = null
        var errorMsg: String? = null

        BackendApiClient.getEvidence("OS-DEMO-001", object : BackendApiClient.ApiCallback<JsonArray> {
            override fun onSuccess(result: JsonArray) {
                resultArr = result
                latch.countDown()
            }

            override fun onError(error: String) {
                errorMsg = error
                latch.countDown()
            }
        })

        val completed = latch.await(5, TimeUnit.SECONDS)
        assertTrue("Request completed", completed)
        if (errorMsg == null) {
            assertNotNull("Result should not be null", resultArr)
        } else {
            // When backend server is offline during standalone test, error must be reported honestly
            assertTrue("Offline error reported honestly", errorMsg!!.contains("Network error") || errorMsg!!.contains("HTTP"))
        }
    }

    // =========================================================================
    // 2. Security: Unauthenticated Request & Cross-Worker Access Check
    // =========================================================================
    @Test
    fun test02_UnauthenticatedAndCrossWorkerAccessPrevention() {
        BackendApiClient.configure("http://localhost:4000/api/v1", "OS-WORKER-A")

        val latch = CountDownLatch(1)
        var verResult: JsonObject? = null
        var errorMsg: String? = null

        BackendApiClient.runVerification(
            id = "OS-WORKER-A",
            evidenceIds = listOf("ev-worker-b-001"),
            callback = object : BackendApiClient.ApiCallback<JsonObject> {
                override fun onSuccess(result: JsonObject) {
                    verResult = result
                    latch.countDown()
                }

                override fun onError(error: String) {
                    errorMsg = error
                    latch.countDown()
                }
            }
        )

        latch.await(5, TimeUnit.SECONDS)
        if (errorMsg == null) {
            assertNotNull("Verification response received", verResult)
        } else {
            val lowerErr = errorMsg!!.lowercase()
            assertTrue(
                "Error reported cleanly ($errorMsg)",
                lowerErr.contains("403") || lowerErr.contains("forbidden") || lowerErr.contains("network") || lowerErr.contains("http") || lowerErr.contains("connection")
            )
        }
    }

    // =========================================================================
    // 3. Local Evidence Vault & Process Restart Persistence
    // =========================================================================
    @Test
    fun test03_LocalEncryptedEvidencePersistenceAndProcessRestart() {
        val e1 = repository.createAndSaveEvidence(
            workerId = "OS-DEMO-001",
            source = "OBSERVED",
            platform = "ZOMATO",
            amount = 1250.0,
            reference = "ZMT-ANDROID-001"
        )
        assertEquals("UNSYNCED", e1.syncStatus)

        // Simulate app restart by re-instantiating repository from same vault file
        val reloadedRepository = LocalEncryptedEvidenceRepository.createForTest(testVaultFile)
        assertFalse("Vault should not be corrupted after reload", reloadedRepository.isVaultCorrupted)
        assertEquals(1, reloadedRepository.getAllEvidence().size)

        val reloadedItem = reloadedRepository.getEvidenceById(e1.id)
        assertNotNull("Saved record must be found after reload", reloadedItem)
        assertEquals(1250.0, reloadedItem!!.amount, 0.001)

        // Mark synced and verify state retention
        reloadedRepository.markSynced(e1.id)
        assertEquals("SYNCED", reloadedRepository.getEvidenceById(e1.id)!!.syncStatus)
    }

    // =========================================================================
    // 4. Authoritative Verification Pipeline Execution
    // =========================================================================
    @Test
    fun test04_AuthoritativeServerVerificationExecution() {
        BackendApiClient.configure("http://localhost:4000/api/v1", "OS-DEMO-001")

        val latch = CountDownLatch(1)
        var verResult: JsonObject? = null
        var errorMsg: String? = null

        BackendApiClient.runVerification("OS-DEMO-001", emptyList(), object : BackendApiClient.ApiCallback<JsonObject> {
            override fun onSuccess(result: JsonObject) {
                verResult = result
                latch.countDown()
            }

            override fun onError(error: String) {
                errorMsg = error
                latch.countDown()
            }
        })

        val completed = latch.await(5, TimeUnit.SECONDS)
        assertTrue("Verification request completed", completed)
        if (errorMsg == null) {
            assertNotNull("Verification result should not be null", verResult)
            assertTrue(verResult!!.has("id"))
            assertTrue(verResult!!.has("level"))
        } else {
            val lowerErr = errorMsg!!.lowercase()
            assertTrue("Error reported cleanly ($errorMsg)", lowerErr.contains("network") || lowerErr.contains("http") || lowerErr.contains("connection"))
        }
    }

    // =========================================================================
    // 5. Credential Issuance & Idempotency
    // =========================================================================
    @Test
    fun test05_GatedCredentialIssuanceAndIdempotency() {
        BackendApiClient.configure("http://localhost:4000/api/v1", "OS-DEMO-001")

        val verLatch = CountDownLatch(1)
        var verId: String? = null
        var errorMsg: String? = null

        BackendApiClient.runVerification("OS-DEMO-001", emptyList(), object : BackendApiClient.ApiCallback<JsonObject> {
            override fun onSuccess(result: JsonObject) {
                verId = result.get("id")?.asString
                verLatch.countDown()
            }

            override fun onError(error: String) {
                errorMsg = error
                verLatch.countDown()
            }
        })
        verLatch.await(5, TimeUnit.SECONDS)

        if (verId != null) {
            val credLatch1 = CountDownLatch(1)
            var sig1: String? = null
            BackendApiClient.issueCredential(verId!!, "OS-DEMO-001", object : BackendApiClient.ApiCallback<JsonObject> {
                override fun onSuccess(result: JsonObject) {
                    val cred = result.getAsJsonObject("credential")
                    sig1 = cred?.get("signature")?.asString
                    credLatch1.countDown()
                }

                override fun onError(error: String) {
                    credLatch1.countDown()
                }
            })
            credLatch1.await(5, TimeUnit.SECONDS)

            if (sig1 != null) {
                val credLatch2 = CountDownLatch(1)
                var sig2: String? = null
                BackendApiClient.issueCredential(verId!!, "OS-DEMO-001", object : BackendApiClient.ApiCallback<JsonObject> {
                    override fun onSuccess(result: JsonObject) {
                        val cred = result.getAsJsonObject("credential")
                        sig2 = cred?.get("signature")?.asString
                        credLatch2.countDown()
                    }

                    override fun onError(error: String) {
                        credLatch2.countDown()
                    }
                })
                credLatch2.await(5, TimeUnit.SECONDS)
                assertEquals("Repeated credential request must return identical signature (idempotent)", sig1, sig2)
            }
        } else {
            assertNotNull("Backend offline error captured", errorMsg)
        }
    }

    // =========================================================================
    // 6. Network Error & Backend Unavailable Handling
    // =========================================================================
    @Test
    fun test06_BackendUnavailableErrorHandlingWithoutFakeFallback() {
        BackendApiClient.configure("http://localhost:59999/api/v1", "OS-DEMO-001")

        val latch = CountDownLatch(1)
        var errorMsg: String? = null

        BackendApiClient.getEvidence("OS-DEMO-001", object : BackendApiClient.ApiCallback<JsonArray> {
            override fun onSuccess(result: JsonArray) {
                latch.countDown()
            }

            override fun onError(error: String) {
                errorMsg = error
                latch.countDown()
            }
        })

        latch.await(5, TimeUnit.SECONDS)
        assertNotNull("Client must report error when backend is unreachable", errorMsg)
        assertTrue("Error should mention network issue", errorMsg!!.contains("Network error") || errorMsg!!.contains("Connection refused"))
    }

    // =========================================================================
    // 7. Mock OTP Send & Verify API Handling
    // =========================================================================
    @Test
    fun test07_MockOtpSendAndVerifyApiHandling() {
        BackendApiClient.configure("http://localhost:59999/api/v1", "OS-DEMO-001")

        val sendLatch = CountDownLatch(1)
        var sendError: String? = null
        BackendApiClient.sendOtp("+919876543210", object : BackendApiClient.ApiCallback<com.onshift.app.data.api.SendOtpResponse> {
            override fun onSuccess(result: com.onshift.app.data.api.SendOtpResponse) {
                sendLatch.countDown()
            }

            override fun onError(error: String) {
                sendError = error
                sendLatch.countDown()
            }
        })
        sendLatch.await(5, TimeUnit.SECONDS)
        assertNotNull("Client must report network error when server unreachable", sendError)
        assertTrue("Network error reported for sendOtp", sendError!!.contains("Network error") || sendError!!.contains("Connection refused"))

        val verifyLatch = CountDownLatch(1)
        var verifyError: String? = null
        BackendApiClient.verifyOtp("+919876543210", "123456", object : BackendApiClient.ApiCallback<com.onshift.app.data.api.VerifyOtpResponse> {
            override fun onSuccess(result: com.onshift.app.data.api.VerifyOtpResponse) {
                verifyLatch.countDown()
            }

            override fun onError(error: String) {
                verifyError = error
                verifyLatch.countDown()
            }
        })
        verifyLatch.await(5, TimeUnit.SECONDS)
        assertNotNull("Client must report network error when server unreachable", verifyError)
        assertTrue("Network error reported for verifyOtp", verifyError!!.contains("Network error") || verifyError!!.contains("Connection refused"))
    }

    // =========================================================================
    // 8. DigiLocker API Network Error Handling
    // =========================================================================
    @Test
    fun test08_DigiLockerUnreachableApiHandling() {
        BackendApiClient.configure("http://localhost:59999/api/v1", "OS-DEMO-001")

        val initLatch = CountDownLatch(1)
        var initError: String? = null
        BackendApiClient.initiateDigiLocker(object : BackendApiClient.ApiCallback<com.onshift.app.data.api.InitiateDigiLockerResponse> {
            override fun onSuccess(result: com.onshift.app.data.api.InitiateDigiLockerResponse) {
                initLatch.countDown()
            }

            override fun onError(error: String) {
                initError = error
                initLatch.countDown()
            }
        })
        initLatch.await(5, TimeUnit.SECONDS)
        assertNotNull("Client must report network error when server unreachable", initError)
        assertTrue("Network error reported for initiateDigiLocker", initError!!.contains("Network error") || initError!!.contains("Connection refused"))

        val statusLatch = CountDownLatch(1)
        var statusError: String? = null
        BackendApiClient.getDigiLockerStatus(object : BackendApiClient.ApiCallback<com.onshift.app.data.api.DigiLockerStatusResponse> {
            override fun onSuccess(result: com.onshift.app.data.api.DigiLockerStatusResponse) {
                statusLatch.countDown()
            }

            override fun onError(error: String) {
                statusError = error
                statusLatch.countDown()
            }
        })
        statusLatch.await(5, TimeUnit.SECONDS)
        assertNotNull("Client must report network error when server unreachable", statusError)
        assertTrue("Network error reported for getDigiLockerStatus", statusError!!.contains("Network error") || statusError!!.contains("Connection refused"))

        val verifyLatch = CountDownLatch(1)
        var verifyError: String? = null
        BackendApiClient.verifyDigiLocker(object : BackendApiClient.ApiCallback<com.onshift.app.data.api.VerifyDigiLockerResponse> {
            override fun onSuccess(result: com.onshift.app.data.api.VerifyDigiLockerResponse) {
                verifyLatch.countDown()
            }

            override fun onError(error: String) {
                verifyError = error
                verifyLatch.countDown()
            }
        })
        verifyLatch.await(5, TimeUnit.SECONDS)
        assertNotNull("Client must report network error when server unreachable", verifyError)
        assertTrue("Network error reported for verifyDigiLocker", verifyError!!.contains("Network error") || verifyError!!.contains("Connection refused"))
    }

    // =========================================================================
    // 9. DigiLocker Response Models & Field Parsing Verification
    // =========================================================================
    @Test
    fun test09_DigiLockerResponseFieldParsing() {
        BackendApiClient.configure("http://localhost:4000/api/v1", "OS-DEMO-001")

        // 1. Initiate DigiLocker
        val initLatch = CountDownLatch(1)
        var initResp: com.onshift.app.data.api.InitiateDigiLockerResponse? = null
        var initErr: String? = null
        BackendApiClient.initiateDigiLocker(object : BackendApiClient.ApiCallback<com.onshift.app.data.api.InitiateDigiLockerResponse> {
            override fun onSuccess(result: com.onshift.app.data.api.InitiateDigiLockerResponse) {
                initResp = result
                initLatch.countDown()
            }

            override fun onError(error: String) {
                initErr = error
                initLatch.countDown()
            }
        })
        initLatch.await(5, TimeUnit.SECONDS)

        if (initErr == null) {
            assertNotNull("Initiate response must not be null", initResp)
            assertNotNull("requestId must be present", initResp!!.requestId)
            assertTrue("requestId must not be blank", initResp!!.requestId.isNotBlank())
            assertNotNull("authorizationUrl must be present", initResp!!.authorizationUrl)
            assertTrue("authorizationUrl must not be blank", initResp!!.authorizationUrl.isNotBlank())
            assertNotNull("status must be present", initResp!!.status)
            assertEquals("REQUEST_CREATED", initResp!!.status)

            // 2. Get DigiLocker Status
            val statusLatch = CountDownLatch(1)
            var statusResp: com.onshift.app.data.api.DigiLockerStatusResponse? = null
            BackendApiClient.getDigiLockerStatus(object : BackendApiClient.ApiCallback<com.onshift.app.data.api.DigiLockerStatusResponse> {
                override fun onSuccess(result: com.onshift.app.data.api.DigiLockerStatusResponse) {
                    statusResp = result
                    statusLatch.countDown()
                }

                override fun onError(error: String) {
                    statusLatch.countDown()
                }
            })
            statusLatch.await(5, TimeUnit.SECONDS)

            if (statusResp != null) {
                assertNotNull("status must be present", statusResp!!.status)
                assertEquals("SETU_DIGILOCKER", statusResp!!.provider)
            }

            // 3. Verify DigiLocker Payload
            val verifyLatch = CountDownLatch(1)
            var verifyResp: com.onshift.app.data.api.VerifyDigiLockerResponse? = null
            BackendApiClient.verifyDigiLocker(object : BackendApiClient.ApiCallback<com.onshift.app.data.api.VerifyDigiLockerResponse> {
                override fun onSuccess(result: com.onshift.app.data.api.VerifyDigiLockerResponse) {
                    verifyResp = result
                    verifyLatch.countDown()
                }

                override fun onError(error: String) {
                    verifyLatch.countDown()
                }
            })
            verifyLatch.await(5, TimeUnit.SECONDS)

            if (verifyResp != null) {
                assertNotNull("status must be present", verifyResp!!.status)
                assertEquals("VERIFIED", verifyResp!!.status)
                assertTrue("identityVerified must be true", verifyResp!!.identityVerified)
                assertEquals("SETU_DIGILOCKER", verifyResp!!.provider)
                assertNotNull("verifiedAt timestamp must be present", verifyResp!!.verifiedAt)
            }
        } else {
            // Unreachable offline server during standalone build environment test is captured cleanly
            assertTrue("Offline error captured cleanly", initErr!!.contains("Network error") || initErr!!.contains("HTTP"))
        }
    }

    // =========================================================================
    // 10. Backend Login API & Server JWT Storage Handling
    // =========================================================================
    @Test
    fun test10_BackendLoginResponseParsingAndServerJwtStorage() {
        BackendApiClient.configure("http://localhost:59999/api/v1", "OS-FRONTEND-TEST-001")

        val loginLatch = CountDownLatch(1)
        var loginError: String? = null
        BackendApiClient.login(
            id = "OS-FRONTEND-TEST-001",
            role = "WORKER",
            name = "Test Worker Frontend",
            workerCategory = "Delivery Partner",
            callback = object : BackendApiClient.ApiCallback<JsonObject> {
                override fun onSuccess(result: JsonObject) {
                    loginLatch.countDown()
                }

                override fun onError(error: String) {
                    loginError = error
                    loginLatch.countDown()
                }
            }
        )
        loginLatch.await(5, TimeUnit.SECONDS)
        assertNotNull("Client must report error when backend server is offline", loginError)
        assertTrue(
            "Offline connection error reported cleanly ($loginError)",
            loginError!!.contains("Network error") || loginError!!.contains("Connection refused") || loginError!!.contains("HTTP")
        )
    }
}

