package com.onshift.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.onshift.app.data.model.UserAccount
import com.onshift.app.data.model.UserPreferences
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
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
        val IS_IDENTITY_VERIFIED = booleanPreferencesKey("is_identity_verified")
        val PASSWORD_HASH = stringPreferencesKey("password_hash")
        val WORKER_ID = stringPreferencesKey("worker_id")
        val AUTH_TOKEN = stringPreferencesKey("auth_token")
        val ACCOUNTS_LIST = stringPreferencesKey("accounts_list")
    }

    private val gson = Gson()

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
            val fullName = preferences[PreferencesKeys.FULL_NAME] ?: "Sadhana R Somaiya"
            val phoneNumber = preferences[PreferencesKeys.PHONE_NUMBER] ?: "+91 98765 43210"
            val dateOfBirth = preferences[PreferencesKeys.DATE_OF_BIRTH] ?: "1998-05-15"
            val gender = preferences[PreferencesKeys.GENDER] ?: "Female"
            val state = preferences[PreferencesKeys.STATE] ?: "Maharashtra"
            val city = preferences[PreferencesKeys.CITY] ?: "Mumbai"
            val email = preferences[PreferencesKeys.EMAIL] ?: "sadhana.r@somaiya.edu"
            val isLoggedIn = preferences[PreferencesKeys.IS_LOGGED_IN] ?: false
            val isPhoneVerified = preferences[PreferencesKeys.IS_PHONE_VERIFIED] ?: false
            val isIdentityVerified = preferences[PreferencesKeys.IS_IDENTITY_VERIFIED] ?: false
            val passwordHash = preferences[PreferencesKeys.PASSWORD_HASH] ?: ""
            val workerId = preferences[PreferencesKeys.WORKER_ID] ?: "OS-SADHANA-001"
            val authToken = preferences[PreferencesKeys.AUTH_TOKEN] ?: ""
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
                isIdentityVerified = isIdentityVerified,
                passwordHash = passwordHash,
                workerId = workerId,
                authToken = authToken
            )
        }

    /** Retrieves all stored UserAccounts from DataStore (Gson serialized). */
    suspend fun getStoredAccounts(): List<UserAccount> {
        val prefs = context.dataStore.data.first()
        val json = prefs[PreferencesKeys.ACCOUNTS_LIST]
        if (json.isNullOrBlank()) {
            return emptyList()
        }
        return try {
            val type = object : TypeToken<List<UserAccount>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    /** Finds a UserAccount matching email or workerId. */
    suspend fun getAccountByEmailOrId(emailOrId: String): UserAccount? {
        val accounts = getStoredAccounts()
        val target = emailOrId.trim()
        return accounts.find {
            it.email.equals(target, ignoreCase = true) || it.workerId.equals(target, ignoreCase = true)
        }
    }

    /** Saves or updates a UserAccount in the accounts list without overwriting other accounts. */
    suspend fun saveUserAccount(account: UserAccount) {
        val currentAccounts = getStoredAccounts().toMutableList()
        val index = currentAccounts.indexOfFirst {
            it.email.equals(account.email, ignoreCase = true) ||
            (account.workerId.isNotBlank() && it.workerId.equals(account.workerId, ignoreCase = true))
        }
        if (index >= 0) {
            currentAccounts[index] = account
        } else {
            currentAccounts.add(account)
        }
        val jsonStr = gson.toJson(currentAccounts)
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.ACCOUNTS_LIST] = jsonStr
        }
    }

    /** Switches the currently active session in DataStore to the specified UserAccount's details. */
    suspend fun switchActiveAccount(account: UserAccount) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.FULL_NAME] = account.fullName
            preferences[PreferencesKeys.PHONE_NUMBER] = account.phoneNumber
            preferences[PreferencesKeys.DATE_OF_BIRTH] = account.dateOfBirth
            preferences[PreferencesKeys.GENDER] = account.gender
            preferences[PreferencesKeys.STATE] = account.state
            preferences[PreferencesKeys.CITY] = account.city
            preferences[PreferencesKeys.EMAIL] = account.email
            preferences[PreferencesKeys.WORKER_ID] = account.workerId
            if (account.passwordHash.isNotEmpty()) {
                preferences[PreferencesKeys.PASSWORD_HASH] = account.passwordHash
            }
            preferences[PreferencesKeys.IS_LOGGED_IN] = true
        }
        saveUserAccount(account)
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

    suspend fun updateIdentityVerified(verified: Boolean) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.IS_IDENTITY_VERIFIED] = verified
        }
    }

    suspend fun updateWorkerId(workerId: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.WORKER_ID] = workerId
        }
    }

    suspend fun updateAuthToken(token: String) {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.AUTH_TOKEN] = token
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
        email: String = "sadhana.r@somaiya.edu",
        password: String = ""
    ) {
        val passHash = if (password.isNotEmpty()) com.onshift.app.utils.PasswordHasher.hashPassword(password) else ""
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.FULL_NAME] = fullName
            preferences[PreferencesKeys.PHONE_NUMBER] = phoneNumber
            preferences[PreferencesKeys.DATE_OF_BIRTH] = dateOfBirth
            preferences[PreferencesKeys.GENDER] = gender
            preferences[PreferencesKeys.STATE] = state
            preferences[PreferencesKeys.CITY] = city
            preferences[PreferencesKeys.EMAIL] = email
            if (passHash.isNotEmpty()) {
                preferences[PreferencesKeys.PASSWORD_HASH] = passHash
            }
        }

        // Also update the account entry in the accounts list
        val currentPref = userPreferencesFlow.first()
        val account = UserAccount(
            email = email,
            passwordHash = if (passHash.isNotEmpty()) passHash else currentPref.passwordHash,
            fullName = fullName,
            phoneNumber = phoneNumber,
            dateOfBirth = dateOfBirth,
            gender = gender,
            state = state,
            city = city,
            workerId = currentPref.workerId
        )
        saveUserAccount(account)
    }

    /**
     * Clears only the authentication session (JWT/token and signed-in state).
     * Preserves language preference, selected platforms, and saved account records list.
     */
    suspend fun clearSession() {
        context.dataStore.edit { preferences ->
            preferences[PreferencesKeys.IS_LOGGED_IN] = false
            preferences[PreferencesKeys.ONBOARDING_COMPLETED] = false
            preferences[PreferencesKeys.AUTH_TOKEN] = ""
        }
    }

    suspend fun clearPreferences() {
        context.dataStore.edit { preferences ->
            preferences.clear()
        }
    }
}
