package com.onshift.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import com.onshift.app.data.model.UserPreferences
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "user_preferences")

class UserPreferencesRepository(private val context: Context) {
    private object PreferencesKeys {
        val LANGUAGE = stringPreferencesKey("language")
        val SELECTED_PLATFORMS = stringSetPreferencesKey("selected_platforms")
        val ONBOARDING_COMPLETED = booleanPreferencesKey("onboarding_completed")
        val LAST_BACKED_UP_AT = longPreferencesKey("last_backed_up_at")
        val FULL_NAME = stringPreferencesKey("full_name")
        val PHONE_NUMBER = stringPreferencesKey("phone_number")
        val DATE_OF_BIRTH = stringPreferencesKey("date_of_birth")
        val GENDER = stringPreferencesKey("gender")
        val STATE = stringPreferencesKey("state")
        val CITY = stringPreferencesKey("city")
        val EMAIL = stringPreferencesKey("email")
        val IS_LOGGED_IN = booleanPreferencesKey("is_logged_in")
        val IS_PHONE_VERIFIED = booleanPreferencesKey("is_phone_verified")
        val PASSWORD_HASH = stringPreferencesKey("password_hash")
        val WORKER_ID = stringPreferencesKey("worker_id")
    }

    val userPreferencesFlow: Flow<UserPreferences> = context.dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            val language = preferences[PreferencesKeys.LANGUAGE] ?: ""
            val selectedPlatforms = preferences[PreferencesKeys.SELECTED_PLATFORMS]?.toList() ?: emptyList()
            val onboardingCompleted = preferences[PreferencesKeys.ONBOARDING_COMPLETED] ?: false
            val lastBackedUpAt = preferences[PreferencesKeys.LAST_BACKED_UP_AT]
            val fullName = preferences[PreferencesKeys.FULL_NAME] ?: "Vikram Malhotra"
            val phoneNumber = preferences[PreferencesKeys.PHONE_NUMBER] ?: "+91 98765 43210"
            val dateOfBirth = preferences[PreferencesKeys.DATE_OF_BIRTH] ?: "1995-08-15"
            val gender = preferences[PreferencesKeys.GENDER] ?: "Male"
            val state = preferences[PreferencesKeys.STATE] ?: "Maharashtra"
            val city = preferences[PreferencesKeys.CITY] ?: "Mumbai"
            val email = preferences[PreferencesKeys.EMAIL] ?: "vikram.malhotra@example.com"
            val isLoggedIn = preferences[PreferencesKeys.IS_LOGGED_IN] ?: false
            val isPhoneVerified = preferences[PreferencesKeys.IS_PHONE_VERIFIED] ?: false
            val passwordHash = preferences[PreferencesKeys.PASSWORD_HASH] ?: ""
            val workerId = preferences[PreferencesKeys.WORKER_ID] ?: "OS-DEMO-001"
            UserPreferences(
                language = language,
                selectedPlatforms = selectedPlatforms,
                onboardingCompleted = onboardingCompleted,
                lastBackedUpAt = lastBackedUpAt,
                fullName = fullName,
                phoneNumber = phoneNumber,
                dateOfBirth = dateOfBirth,
                gender = gender,
                state = state,
                city = city,
                email = email,
                isLoggedIn = isLoggedIn,
                isPhoneVerified = isPhoneVerified,
                passwordHash = passwordHash,
                workerId = workerId
            )
        }

    suspend fun updateLanguage(language: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.LANGUAGE] = language
        }
    }

    suspend fun updateSelectedPlatforms(platforms: List<String>) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.SELECTED_PLATFORMS] = platforms.toSet()
        }
    }

    suspend fun setOnboardingCompleted(completed: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.ONBOARDING_COMPLETED] = completed
        }
    }

    suspend fun setLoggedIn(loggedIn: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.IS_LOGGED_IN] = loggedIn
        }
    }

    suspend fun updatePhoneVerified(verified: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.IS_PHONE_VERIFIED] = verified
        }
    }

    suspend fun updateWorkerId(workerId: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.WORKER_ID] = workerId
        }
    }

    suspend fun updateLastBackedUpAt(timestamp: Long) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.LAST_BACKED_UP_AT] = timestamp
        }
    }

    suspend fun updatePersonalDetails(
        fullName: String,
        phoneNumber: String,
        dateOfBirth: String,
        gender: String,
        state: String,
        city: String,
        email: String = "vikram.malhotra@example.com",
        password: String = ""
    ) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.FULL_NAME] = fullName
            preferences[PreferencesKeys.PHONE_NUMBER] = phoneNumber
            preferences[PreferencesKeys.DATE_OF_BIRTH] = dateOfBirth
            preferences[PreferencesKeys.GENDER] = gender
            preferences[PreferencesKeys.STATE] = state
            preferences[PreferencesKeys.CITY] = city
            preferences[PreferencesKeys.EMAIL] = email
            if (password.isNotEmpty()) {
                preferences[PreferencesKeys.PASSWORD_HASH] = com.onshift.app.utils.PasswordHasher.hashPassword(password)
            }
        }
    }

    /**
     * Clears only the authentication session (JWT/token and signed-in state).
     * Preserves language preference, selected platforms, and personal details.
     */
    suspend fun clearSession() {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.IS_LOGGED_IN] = false
            preferences[PreferencesKeys.ONBOARDING_COMPLETED] = false
        }
    }

    suspend fun clearPreferences() {
        context.dataStore.edit { preferences ->
            preferences.clear()
        }
    }
}
