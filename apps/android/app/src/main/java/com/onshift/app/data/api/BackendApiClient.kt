package com.onshift.app.data.api

import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import java.util.Base64

object BackendApiClient {
    private var baseUrl: String = "http://localhost:4000/api/v1"
    private var authToken: String? = null
    private var workerId: String = "OS-DEMO-001"
    private val executor = Executors.newSingleThreadExecutor()

    fun createJwtToken(sub: String, secret: String = "24bb3889a3eb46f539d326b55ea6a58ea92b8bc37d0299a2f44b5be691af4b57"): String {
        val encoder = Base64.getUrlEncoder().withoutPadding()
        val header = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}"
        val now = System.currentTimeMillis() / 1000
        val exp = now + 86400
        val payload = "{\"sub\":\"$sub\",\"workerId\":\"$sub\",\"role\":\"WORKER\",\"iat\":$now,\"exp\":$exp}"
        val encodedHeader = encoder.encodeToString(header.toByteArray(Charsets.UTF_8))
        val encodedPayload = encoder.encodeToString(payload.toByteArray(Charsets.UTF_8))
        val data = "$encodedHeader.$encodedPayload"

        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        val signature = encoder.encodeToString(mac.doFinal(data.toByteArray(Charsets.UTF_8)))
        return "$data.$signature"
    }

    fun configure(url: String = "http://10.0.2.2:4000/api/v1", id: String = "OS-DEMO-001") {
        this.baseUrl = url.trimEnd('/')
        this.workerId = id
        this.authToken = createJwtToken(id)
    }

    fun setAuth(id: String, token: String) {
        this.workerId = id
        this.authToken = token
    }

    fun getWorkerId(): String = workerId

    fun login(
        id: String = workerId,
        role: String = "WORKER",
        callback: ApiCallback<JsonObject>
    ) {
        val payload = JsonObject()
        payload.addProperty("workerId", id)
        payload.addProperty("role", role)
        makeRequest("/auth/login", "POST", payload, object : ApiCallback<JsonObject> {
            override fun onSuccess(result: JsonObject) {
                val token = result.get("token")?.asString
                if (!token.isNullOrEmpty()) {
                    setAuth(id, token)
                }
                callback.onSuccess(result)
            }

            override fun onError(error: String) {
                callback.onError(error)
            }
        })
    }

    fun createWorker(
        id: String = workerId,
        name: String,
        category: String = "Gig Worker",
        location: String = "",
        callback: ApiCallback<JsonObject>
    ) {
        val payload = JsonObject()
        payload.addProperty("id", id)
        payload.addProperty("name", name)
        payload.addProperty("workerCategory", category)
        payload.addProperty("location", location)

        makeRequest("/workers", "POST", payload, callback)
    }

    interface ApiCallback<T> {
        fun onSuccess(result: T)
        fun onError(error: String)
    }

    private fun makeRequest(
        endpoint: String,
        method: String,
        body: JsonObject? = null,
        callback: ApiCallback<JsonObject>
    ) {
        executor.execute {
            var conn: HttpURLConnection? = null
            try {
                val url = URL("$baseUrl$endpoint")
                conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = method
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Accept", "application/json")

                val token = authToken ?: createJwtToken(workerId)
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.setRequestProperty("x-worker-id", workerId)

                if (body != null && (method == "POST" || method == "PUT")) {
                    conn.doOutput = true
                    val writer = OutputStreamWriter(conn.outputStream, "UTF-8")
                    writer.write(body.toString())
                    writer.flush()
                    writer.close()
                }

                val responseCode = conn.responseCode
                val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
                val reader = BufferedReader(InputStreamReader(stream, "UTF-8"))
                val responseStr = reader.use { it.readText() }

                if (responseCode in 200..299) {
                    val element = JsonParser.parseString(responseStr)
                    val jsonObj = if (element.isJsonObject) {
                        element.asJsonObject
                    } else {
                        val wrapper = JsonObject()
                        wrapper.add("data", element)
                        wrapper
                    }
                    callback.onSuccess(jsonObj)
                } else {
                    val errObj = try { JsonParser.parseString(responseStr).asJsonObject } catch (_: Exception) { null }
                    val message = errObj?.get("message")?.asString ?: "HTTP Error $responseCode"
                    callback.onError(message)
                }
            } catch (e: Exception) {
                callback.onError("Network error: ${e.message}")
            } finally {
                conn?.disconnect()
            }
        }
    }

    fun getEvidence(id: String = workerId, callback: ApiCallback<JsonArray>) {
        executor.execute {
            var conn: HttpURLConnection? = null
            try {
                val url = URL("$baseUrl/evidence/worker/$id")
                conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                val token = authToken ?: createJwtToken(id)
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.setRequestProperty("x-worker-id", id)

                val responseCode = conn.responseCode
                val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
                val reader = BufferedReader(InputStreamReader(stream, "UTF-8"))
                val responseStr = reader.use { it.readText() }

                if (responseCode in 200..299) {
                    val array = JsonParser.parseString(responseStr).asJsonArray
                    callback.onSuccess(array)
                } else {
                    callback.onError("HTTP $responseCode: $responseStr")
                }
            } catch (e: Exception) {
                callback.onError("Network error: ${e.message}")
            } finally {
                conn?.disconnect()
            }
        }
    }

    fun runVerification(
        id: String = workerId,
        evidenceIds: List<String> = emptyList(),
        callback: ApiCallback<JsonObject>
    ) {
        val payload = JsonObject()
        payload.addProperty("workerId", id)
        
        val period = JsonObject()
        period.addProperty("startDate", "2026-08-01")
        period.addProperty("endDate", "2026-08-07")
        payload.add("payoutPeriod", period)

        val idsArr = JsonArray()
        evidenceIds.forEach { idsArr.add(it) }
        payload.add("evidenceIds", idsArr)

        makeRequest("/verification/run", "POST", payload, callback)
    }

    fun issueCredential(
        verificationId: String,
        id: String = workerId,
        callback: ApiCallback<JsonObject>
    ) {
        val payload = JsonObject()
        payload.addProperty("verificationId", verificationId)
        payload.addProperty("workerId", id)

        makeRequest("/credentials/issue", "POST", payload, callback)
    }

    fun recommendSchemes(
        monthlyIncome: Double = 30100.0,
        verificationLevel: String = "FINANCIALLY_CORROBORATED",
        callback: ApiCallback<JsonObject>
    ) {
        val payload = JsonObject()
        payload.addProperty("monthlyIncome", monthlyIncome)
        payload.addProperty("workerCategory", "Delivery Partner")
        payload.addProperty("location", "Maharashtra")
        payload.addProperty("verificationLevel", verificationLevel)

        makeRequest("/schemes/recommend", "POST", payload, callback)
    }
}
