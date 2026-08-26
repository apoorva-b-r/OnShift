package com.onshift.app.utils

import java.security.MessageDigest

object PasswordHasher {
    /**
     * Hashes plain text password using SHA-256 algorithm.
     * Returns hexadecimal representation of the hash.
     */
    fun hashPassword(password: String): String {
        if (password.isEmpty()) return ""
        val bytes = MessageDigest.getInstance("SHA-256").digest(password.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
