package com.onshift.app.utils

import java.time.LocalDate
import java.time.Period
import java.time.format.DateTimeFormatter

object AgeCalculator {
    /**
     * Calculates age in completed years based on a DOB string formatted as "yyyy-MM-dd".
     * Returns null if parsing fails or if DOB is in the future.
     */
    fun calculateAge(dobString: String): Int? {
        if (dobString.isBlank()) return null
        return try {
            val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd")
            val dob = LocalDate.parse(dobString.trim(), formatter)
            val now = LocalDate.now()
            if (dob.isAfter(now)) null else Period.between(dob, now).years
        } catch (e: Exception) {
            null
        }
    }
}
