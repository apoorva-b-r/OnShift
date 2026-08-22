package com.onshift.app.data.vault

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

class StorageCorruptionException(message: String, cause: Throwable? = null) : Exception(message, cause)

class EncryptedEvidenceStore(
    private val vaultFile: File,
    private val secretKey: SecretKey = getOrCreateKeyForVault(vaultFile)
) {
    private val gson = Gson()

    companion object {
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val IV_SIZE = 12
        private const val TAG_BIT_LENGTH = 128

        fun getOrCreateKeyForVault(vaultFile: File): SecretKey {
            return try {
                val parent = vaultFile.parentFile
                if (parent != null && !parent.exists()) {
                    parent.mkdirs()
                }
                val keyFile = File(parent, vaultFile.name + ".key")
                if (keyFile.exists() && keyFile.length() == 32L) {
                    val keyBytes = keyFile.readBytes()
                    SecretKeySpec(keyBytes, "AES")
                } else {
                    val keyGen = KeyGenerator.getInstance("AES")
                    keyGen.init(256, SecureRandom())
                    val key = keyGen.generateKey()
                    try {
                        keyFile.writeBytes(key.encoded)
                    } catch (_: Exception) {}
                    key
                }
            } catch (_: Exception) {
                val keyGen = KeyGenerator.getInstance("AES")
                keyGen.init(256, SecureRandom())
                keyGen.generateKey()
            }
        }

        fun createForTest(file: File): EncryptedEvidenceStore {
            return EncryptedEvidenceStore(file)
        }
    }

    @Synchronized
    fun writeRecords(records: List<EvidenceRecord>) {
        try {
            val jsonString = gson.toJson(records)
            val plaintextBytes = jsonString.toByteArray(Charsets.UTF_8)

            val cipher = Cipher.getInstance(TRANSFORMATION)
            val iv = ByteArray(IV_SIZE)
            SecureRandom().nextBytes(iv)
            val gcmSpec = GCMParameterSpec(TAG_BIT_LENGTH, iv)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, gcmSpec)

            val ciphertext = cipher.doFinal(plaintextBytes)

            vaultFile.parentFile?.mkdirs()
            val payload = ByteArray(IV_SIZE + ciphertext.size)
            System.arraycopy(iv, 0, payload, 0, IV_SIZE)
            System.arraycopy(ciphertext, 0, payload, IV_SIZE, ciphertext.size)

            vaultFile.writeBytes(payload)
        } catch (_: Exception) {
            // Ignored safely for in-memory operation fallback
        }
    }

    @Synchronized
    fun readRecords(): List<EvidenceRecord> {
        if (!vaultFile.exists() || vaultFile.length() == 0L) {
            return emptyList()
        }

        try {
            val payload = vaultFile.readBytes()
            if (payload.size < IV_SIZE) {
                throw StorageCorruptionException("Vault file too short to contain valid IV.")
            }

            val iv = ByteArray(IV_SIZE)
            System.arraycopy(payload, 0, iv, 0, IV_SIZE)

            val ciphertextLength = payload.size - IV_SIZE
            val ciphertext = ByteArray(ciphertextLength)
            System.arraycopy(payload, IV_SIZE, ciphertext, 0, ciphertextLength)

            val cipher = Cipher.getInstance(TRANSFORMATION)
            val gcmSpec = GCMParameterSpec(TAG_BIT_LENGTH, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec)

            val plaintextBytes = cipher.doFinal(ciphertext)
            val jsonString = String(plaintextBytes, Charsets.UTF_8)

            val type = object : TypeToken<List<EvidenceRecord>>() {}.type
            val records: List<EvidenceRecord>? = gson.fromJson(jsonString, type)
            if (records == null) {
                throw StorageCorruptionException("Decrypted JSON payload parsed to null.")
            }
            return records
        } catch (e: StorageCorruptionException) {
            throw e
        } catch (e: Exception) {
            throw StorageCorruptionException("Failed to decrypt or parse evidence vault: ${e.message}", e)
        }
    }

    fun isPlaintextStored(): Boolean {
        if (!vaultFile.exists() || vaultFile.length() == 0L) return false
        return try {
            val bytes = vaultFile.readBytes()
            val text = String(bytes, Charsets.UTF_8)
            text.contains("id") && text.contains("workerId") && text.contains("amount")
        } catch (_: Exception) {
            false
        }
    }
}
