package com.onshift.app.data.repository

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.onshift.app.data.model.LiveSchemeRecommendation
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

sealed class SchemeWsEvent {
    object Connecting : SchemeWsEvent()
    data class Chunk(val schemeId: String, val text: String) : SchemeWsEvent()
    data class Complete(val recommendations: List<LiveSchemeRecommendation>, val engineSource: String) : SchemeWsEvent()
    data class Error(val message: String) : SchemeWsEvent()
}

class SchemeWebSocketRepository(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build(),
    private val gson: Gson = Gson()
) {
    companion object {
        const val DEFAULT_WS_URL = "ws://10.0.2.2:3000"
    }

    fun getRecommendationsStream(
        workerProfile: Map<String, Any>,
        wsUrl: String = DEFAULT_WS_URL
    ): Flow<SchemeWsEvent> = callbackFlow {
        trySend(SchemeWsEvent.Connecting)

        val request = Request.Builder()
            .url(wsUrl)
            .build()

        val listener = object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val messageMap = mapOf(
                    "type" to "scheme:recommend",
                    "payload" to workerProfile
                )
                val jsonPayload = gson.toJson(messageMap)
                webSocket.send(jsonPayload)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val root = JsonParser.parseString(text).asJsonObject
                    val type = if (root.has("type")) root.get("type").asString else ""

                    val payloadObj = if (root.has("payload") && root.get("payload").isJsonObject) {
                        root.getAsJsonObject("payload")
                    } else {
                        root
                    }

                    when (type) {
                        "scheme:chunk" -> {
                            val schemeId = if (payloadObj.has("schemeId")) payloadObj.get("schemeId").asString else ""
                            val chunkText = if (payloadObj.has("text")) payloadObj.get("text").asString else ""
                            trySend(SchemeWsEvent.Chunk(schemeId, chunkText))
                        }

                        "scheme:complete" -> {
                            val recsArray = if (payloadObj.has("recommendations") && payloadObj.get("recommendations").isJsonArray) {
                                payloadObj.getAsJsonArray("recommendations")
                            } else if (root.has("recommendations") && root.get("recommendations").isJsonArray) {
                                root.getAsJsonArray("recommendations")
                            } else null

                            val engineSource = if (payloadObj.has("engineSource")) {
                                payloadObj.get("engineSource").asString
                            } else if (root.has("engineSource")) {
                                root.get("engineSource").asString
                            } else "DETERMINISTIC_FALLBACK"

                            val recommendations = mutableListOf<LiveSchemeRecommendation>()
                            recsArray?.forEach { elem ->
                                if (elem.isJsonObject) {
                                    val obj = elem.asJsonObject
                                    val benefits = mutableListOf<String>()
                                    if (obj.has("benefits") && obj.get("benefits").isJsonArray) {
                                        obj.getAsJsonArray("benefits").forEach { b ->
                                            benefits.add(b.asString)
                                        }
                                    }

                                    recommendations.add(
                                        LiveSchemeRecommendation(
                                            schemeId = if (obj.has("schemeId")) obj.get("schemeId").asString else "",
                                            schemeName = if (obj.has("schemeName")) obj.get("schemeName").asString else "",
                                            description = if (obj.has("description")) obj.get("description").asString else "",
                                            relevance = if (obj.has("relevance")) obj.get("relevance").asString else "HIGH",
                                            matchReason = if (obj.has("matchReason")) obj.get("matchReason").asString else "",
                                            benefits = benefits,
                                            applicationUrl = if (obj.has("applicationUrl")) obj.get("applicationUrl").asString else "",
                                            explanationSource = if (obj.has("explanationSource")) obj.get("explanationSource").asString else engineSource
                                        )
                                    )
                                }
                            }

                            trySend(SchemeWsEvent.Complete(recommendations, engineSource))
                        }

                        "scheme:error" -> {
                            val msg = if (payloadObj.has("message")) {
                                payloadObj.get("message").asString
                            } else if (root.has("message")) {
                                root.get("message").asString
                            } else "WebSocket server reported an error"

                            trySend(SchemeWsEvent.Error(msg))
                        }
                    }
                } catch (e: Exception) {
                    trySend(SchemeWsEvent.Error("Parse error: ${e.localizedMessage}"))
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                trySend(SchemeWsEvent.Error(t.localizedMessage ?: "WebSocket Connection Failed"))
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                close()
            }
        }

        val webSocket = client.newWebSocket(request, listener)

        awaitClose {
            webSocket.close(1000, "Flow cancelled")
        }
    }
}
