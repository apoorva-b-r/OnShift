package com.onshift.app.ui.screens

import android.app.Activity
import android.util.Log
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.onshift.app.R
import com.onshift.app.data.PrivacyRepository
import com.onshift.app.data.UserPreferencesRepository
import com.onshift.app.data.model.MockData
import com.onshift.app.data.model.PrivacyRecord
import com.onshift.app.data.model.UserPreferences
import com.onshift.app.ui.common.*
import com.onshift.app.ui.theme.*
import com.onshift.app.utils.AgeCalculator
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private fun getNonEmptyJsonString(json: com.google.gson.JsonObject, key: String): String? {
    return try {
        val elem = json.get(key)
        if (elem != null && !elem.isJsonNull) {
            val str = elem.asString
            if (str.isNotBlank()) str else null
        } else null
    } catch (_: Exception) { null }
}

@Composable
fun ProfileScreen(
    onNavigateToIdentity: () -> Unit = {},
    onTamperDemo: () -> Unit = {},
    onResetHash: () -> Unit = {},
    onRestartDemo: () -> Unit = {},
    onLogout: () -> Unit = {},
    uiState: UiState<PrivacyRecord>? = null
) {
    if (uiState != null) {
        when (uiState) {
            is UiState.Loading -> UiStateLoadingView()
            is UiState.Error -> UiStateErrorView(message = uiState.message)
            is UiState.Empty -> UiStateEmptyView(message = stringResource(R.string.no_platforms_selected))
            is UiState.Success -> ProfileContent(
                privacyRecord = uiState.data,
                userPreferences = UserPreferences(),
                currentLanguage = "en",
                selectedPlatforms = listOf("Zomato", "Swiggy"),
                lastBackedUpAt = null,
                onNavigateToIdentity = onNavigateToIdentity,
                onUpdatePersonalDetails = { _, _, _, _, _, _ -> },
                onUpdateLanguage = { },
                onUpdatePlatforms = { },
                onUpdateLastBackedUpAt = { },
                onTamperDemo = onTamperDemo,
                onResetHash = onResetHash,
                onRestartDemo = onRestartDemo,
                onLogout = onLogout
            )
        }
    } else {
        val context = LocalContext.current
        val coroutineScope = rememberCoroutineScope()
        val repository = remember { UserPreferencesRepository(context.applicationContext) }

        val privacyRecord by PrivacyRepository.privacyRecordState.collectAsState()
        val userPreferences by repository.userPreferencesFlow.collectAsState(initial = UserPreferences())
        val currentLanguage = userPreferences.language
        val selectedPlatforms = userPreferences.selectedPlatforms
        val lastBackedUpAt = userPreferences.lastBackedUpAt

        // Fetch latest profile from MongoDB Atlas on screen launch
        LaunchedEffect(userPreferences.workerId) {
            val targetId = if (userPreferences.workerId.isNotBlank()) userPreferences.workerId else "OS-SADHANA-001"
            com.onshift.app.data.api.BackendApiClient.getWorker(
                id = targetId,
                callback = object : com.onshift.app.data.api.BackendApiClient.ApiCallback<com.google.gson.JsonObject> {
                    override fun onSuccess(result: com.google.gson.JsonObject) {
                        coroutineScope.launch {
                            val name = getNonEmptyJsonString(result, "name") ?: userPreferences.fullName
                            val phone = getNonEmptyJsonString(result, "phoneNumber") ?: userPreferences.phoneNumber
                            val dob = getNonEmptyJsonString(result, "dateOfBirth") ?: userPreferences.dateOfBirth
                            val gender = getNonEmptyJsonString(result, "gender") ?: userPreferences.gender
                            val state = getNonEmptyJsonString(result, "state") ?: userPreferences.state
                            val city = getNonEmptyJsonString(result, "city") ?: userPreferences.city
                            val email = getNonEmptyJsonString(result, "email") ?: userPreferences.email
                            repository.updatePersonalDetails(name, phone, dob, gender, state, city, email)
                            Log.d("ProfileScreen", "Fetched worker profile from MongoDB for worker $targetId: $name ($email)")
                        }
                    }

                    override fun onError(error: String) {
                        Log.w("ProfileScreen", "Could not fetch worker profile from MongoDB for $targetId: $error (using local profile)")
                    }
                }
            )
        }

        ProfileContent(
            privacyRecord = privacyRecord,
            userPreferences = userPreferences,
            currentLanguage = currentLanguage,
            selectedPlatforms = selectedPlatforms,
            lastBackedUpAt = lastBackedUpAt,
            onNavigateToIdentity = onNavigateToIdentity,
            onUpdatePersonalDetails = { name, phone, dob, gender, state, city ->
                coroutineScope.launch {
                    repository.updatePersonalDetails(name, phone, dob, gender, state, city, userPreferences.email)
                    val targetId = if (userPreferences.workerId.isNotBlank()) userPreferences.workerId else "OS-SADHANA-001"
                    // Sync updated profile to MongoDB Atlas via POST /workers
                    com.onshift.app.data.api.BackendApiClient.createWorker(
                        id = targetId,
                        name = name,
                        phoneNumber = phone,
                        email = userPreferences.email,
                        dateOfBirth = dob,
                        gender = gender,
                        state = state,
                        city = city,
                        callback = object : com.onshift.app.data.api.BackendApiClient.ApiCallback<com.google.gson.JsonObject> {
                            override fun onSuccess(result: com.google.gson.JsonObject) {
                                Log.i("ProfileScreen", "Successfully synced updated profile to MongoDB for worker $targetId")
                            }

                            override fun onError(error: String) {
                                Log.w("ProfileScreen", "Failed to sync profile update to MongoDB: $error")
                            }
                        }
                    )
                }
            },
            onUpdateLanguage = { newLang ->
                coroutineScope.launch {
                    repository.updateLanguage(newLang)
                    Log.d("LanguageSwitch", "Setting application locale to: $newLang")
                    AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(newLang))
                    (context as? Activity)?.recreate()
                }
            },
            onUpdatePlatforms = { platforms ->
                coroutineScope.launch {
                    repository.updateSelectedPlatforms(platforms)
                }
            },
            onUpdateLastBackedUpAt = { timestamp ->
                coroutineScope.launch {
                    repository.updateLastBackedUpAt(timestamp)
                }
            },
            onTamperDemo = onTamperDemo,
            onResetHash = onResetHash,
            onRestartDemo = {
                coroutineScope.launch {
                    PrivacyRepository.resetHashChain()
                    repository.clearPreferences()
                    onRestartDemo()
                    (context as? Activity)?.recreate()
                }
            },
            onLogout = {
                coroutineScope.launch {
                    repository.clearSession()
                    onLogout()
                }
            }
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileContent(
    privacyRecord: PrivacyRecord,
    userPreferences: UserPreferences,
    currentLanguage: String,
    selectedPlatforms: List<String>,
    lastBackedUpAt: Long?,
    onNavigateToIdentity: () -> Unit,
    onUpdatePersonalDetails: (String, String, String, String, String, String) -> Unit,
    onUpdateLanguage: (String) -> Unit,
    onUpdatePlatforms: (List<String>) -> Unit,
    onUpdateLastBackedUpAt: (Long) -> Unit,
    onTamperDemo: () -> Unit,
    onResetHash: () -> Unit,
    onRestartDemo: () -> Unit,
    onLogout: () -> Unit
) {
    var showPlatformEditDialog by remember { mutableStateOf(false) }
    var showPersonalDetailsDialog by remember { mutableStateOf(false) }
    var showLogoutConfirmDialog by remember { mutableStateOf(false) }
    var isBackingUp by remember { mutableStateOf(false) }
    var backupProgress by remember { mutableIntStateOf(0) }
    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    val formattedLastBackedUp = remember(lastBackedUpAt) {
        if (lastBackedUpAt != null) {
            val sdf = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault())
            sdf.format(Date(lastBackedUpAt))
        } else {
            null
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(100.dp)
                .clip(CircleShape)
                .background(Primary.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                Icons.Default.Person,
                contentDescription = null,
                modifier = Modifier.size(60.dp),
                tint = Primary
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = userPreferences.fullName,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = OnSurface
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = stringResource(R.string.worker_id_label, if (userPreferences.workerId.isNotBlank()) userPreferences.workerId else "OS-82F91A"),
            style = MaterialTheme.typography.titleMedium,
            color = TextSecondary
        )
        Spacer(modifier = Modifier.height(24.dp))

        // Identity Verification Card
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.identity_verification),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    if (userPreferences.isIdentityVerified) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = StatusReconciled,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = stringResource(R.string.identity_verified),
                                color = StatusReconciled,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    } else {
                        TextButton(onClick = onNavigateToIdentity) {
                            Text(text = stringResource(R.string.verify_with_digilocker), color = Primary)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                ProfileDetailRow(
                    label = "Status",
                    value = if (userPreferences.isIdentityVerified) "Verified via DigiLocker" else "Not verified"
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Personal Details Card
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.personal_details),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    TextButton(onClick = { showPersonalDetailsDialog = true }) {
                        Text(text = stringResource(R.string.edit_personal_details), color = Primary)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                ProfileDetailRow(label = stringResource(R.string.full_name), value = userPreferences.fullName)
                ProfileDetailRow(label = stringResource(R.string.phone_number), value = userPreferences.phoneNumber)
                ProfileDetailRow(label = stringResource(R.string.date_of_birth), value = userPreferences.dateOfBirth)

                // Read-only Age calculated live from DOB via AgeCalculator.calculateAge()
                val calculatedAge = AgeCalculator.calculateAge(userPreferences.dateOfBirth)
                ProfileDetailRow(
                    label = stringResource(R.string.age_label),
                    value = if (calculatedAge != null) stringResource(R.string.age_years, calculatedAge) else "N/A"
                )

                ProfileDetailRow(label = stringResource(R.string.gender), value = userPreferences.gender)
                ProfileDetailRow(label = stringResource(R.string.state), value = userPreferences.state)
                ProfileDetailRow(label = stringResource(R.string.city), value = userPreferences.city)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Privacy Vault Card
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = stringResource(R.string.privacy_vault),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = stringResource(R.string.hash_chain_status) + ": ", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        text = if (privacyRecord.hashChainValid) stringResource(R.string.valid) else stringResource(R.string.tampered),
                        color = if (privacyRecord.hashChainValid) StatusReconciled else StatusUnreconciled,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold
                    )
                }
                Text(
                    text = stringResource(R.string.last_verified, privacyRecord.lastVerifiedAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Platforms Card
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.select_platforms),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    TextButton(onClick = { showPlatformEditDialog = true }) {
                        Text(text = stringResource(R.string.edit_platforms), color = Primary)
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                if (selectedPlatforms.isEmpty()) {
                    Text(
                        text = stringResource(R.string.no_platforms_selected),
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                } else {
                    FlowRow(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        selectedPlatforms.forEach { platform ->
                            AssistChip(
                                onClick = { },
                                label = { Text(platform) },
                                shape = RoundedCornerShape(8.dp)
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Backup & Restore Card (Positioned below Platforms, above Tampering Demo)
        Card(
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Surface)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = stringResource(R.string.backup_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = OnSurface
                )

                Text(
                    text = stringResource(R.string.backup_desc),
                    style = MaterialTheme.typography.bodySmall,
                    color = TextSecondary
                )

                if (isBackingUp) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        LinearProgressIndicator(
                            progress = { backupProgress / 100f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp),
                            color = Primary,
                            trackColor = Color.LightGray.copy(alpha = 0.3f),
                            strokeCap = StrokeCap.Round
                        )
                        Text(
                            text = stringResource(R.string.backed_up_pct, backupProgress),
                            style = MaterialTheme.typography.labelSmall,
                            color = Primary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                if (formattedLastBackedUp != null && !isBackingUp) {
                    Text(
                        text = stringResource(R.string.last_backed_up, formattedLastBackedUp),
                        style = MaterialTheme.typography.bodySmall,
                        color = StatusReconciled,
                        fontWeight = FontWeight.Medium
                    )
                }

                OutlinedButton(
                    onClick = {
                        if (!isBackingUp) {
                            isBackingUp = true
                            backupProgress = 0
                            coroutineScope.launch {
                                for (p in 0..100 step 2) {
                                    delay(40L)
                                    backupProgress = p
                                }
                                backupProgress = 100
                                isBackingUp = false
                                onUpdateLastBackedUpAt(System.currentTimeMillis())
                            }
                        }
                    },
                    enabled = !isBackingUp,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = if (formattedLastBackedUp != null) stringResource(R.string.back_up_again) else stringResource(R.string.back_up_now),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        OutlinedButton(
            onClick = {
                val newLang = if (currentLanguage == "hi") "en" else "hi"
                onUpdateLanguage(newLang)
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            val displayLang = if (currentLanguage == "hi") stringResource(R.string.hindi) else stringResource(R.string.english)
            Text(text = "${stringResource(R.string.change_language)} ($displayLang)")
        }

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = {
                PrivacyRepository.tamperData()
                onTamperDemo()
            },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = StatusUnreconciled),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.demo_tampering), color = Color.White)
        }
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedButton(
            onClick = {
                PrivacyRepository.resetHashChain()
                onResetHash()
            },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = stringResource(R.string.reset_hash), color = StatusReconciled)
        }

        Spacer(modifier = Modifier.height(24.dp))

        TextButton(onClick = onRestartDemo) {
            Text(text = stringResource(R.string.reset_all_data_demo), color = Color.Red.copy(alpha = 0.7f))
        }

        Spacer(modifier = Modifier.height(16.dp))
        HorizontalDivider(color = Color.LightGray.copy(alpha = 0.4f))
        Spacer(modifier = Modifier.height(16.dp))

        // Distinct Logout Section
        Button(
            onClick = { showLogoutConfirmDialog = true },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = StatusUnreconciled),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = "Log Out of Account", color = Color.White, fontWeight = FontWeight.Bold)
        }
    }

    if (showLogoutConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirmDialog = false },
            title = { Text(text = "Confirm Log Out", fontWeight = FontWeight.Bold) },
            text = { Text("Are you sure you want to log out of your OnShift worker account?") },
            confirmButton = {
                Button(
                    onClick = {
                        showLogoutConfirmDialog = false
                        onLogout()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusUnreconciled)
                ) {
                    Text("Log Out", color = Color.White, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutConfirmDialog = false }) {
                    Text(text = stringResource(R.string.cancel))
                }
            }
        )
    }

    if (showPersonalDetailsDialog) {
        var tempName by remember { mutableStateOf(userPreferences.fullName) }
        var tempPhone by remember { mutableStateOf(userPreferences.phoneNumber) }
        var tempDob by remember { mutableStateOf(userPreferences.dateOfBirth) }
        var tempGender by remember { mutableStateOf(userPreferences.gender) }
        var tempState by remember { mutableStateOf(userPreferences.state) }
        var tempCity by remember { mutableStateOf(userPreferences.city) }

        val calculatedAgePreview = remember(tempDob) { AgeCalculator.calculateAge(tempDob) }

        AlertDialog(
            onDismissRequest = { showPersonalDetailsDialog = false },
            title = { Text(text = stringResource(R.string.edit_personal_details), fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = tempName,
                        onValueChange = { tempName = it },
                        label = { Text(stringResource(R.string.full_name)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = tempPhone,
                        onValueChange = { tempPhone = it },
                        label = { Text(stringResource(R.string.phone_number)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Column {
                        OutlinedTextField(
                            value = tempDob,
                            onValueChange = { tempDob = it },
                            label = { Text(stringResource(R.string.date_of_birth) + " (YYYY-MM-DD)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (calculatedAgePreview != null) {
                                "Calculated Age: ${stringResource(R.string.age_years, calculatedAgePreview)} (Read-only)"
                            } else {
                                "Calculated Age: N/A (Enter YYYY-MM-DD)"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = TextSecondary
                        )
                    }
                    OutlinedTextField(
                        value = tempGender,
                        onValueChange = { tempGender = it },
                        label = { Text(stringResource(R.string.gender)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = tempState,
                        onValueChange = { tempState = it },
                        label = { Text(stringResource(R.string.state)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = tempCity,
                        onValueChange = { tempCity = it },
                        label = { Text(stringResource(R.string.city)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onUpdatePersonalDetails(
                            tempName,
                            tempPhone,
                            tempDob,
                            tempGender,
                            tempState,
                            tempCity
                        )
                        showPersonalDetailsDialog = false
                    }
                ) {
                    Text(text = stringResource(R.string.save_details))
                }
            },
            dismissButton = {
                TextButton(onClick = { showPersonalDetailsDialog = false }) {
                    Text(text = stringResource(R.string.cancel))
                }
            }
        )
    }

    if (showPlatformEditDialog) {
        val availablePlatforms = listOf(
            stringResource(R.string.zomato),
            stringResource(R.string.swiggy),
            stringResource(R.string.blinkit)
        )
        var tempSelections by remember(selectedPlatforms) { mutableStateOf(selectedPlatforms.toSet()) }

        AlertDialog(
            onDismissRequest = { showPlatformEditDialog = false },
            title = { Text(text = stringResource(R.string.select_platforms), fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    availablePlatforms.forEach { platform ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    tempSelections = if (tempSelections.contains(platform)) {
                                        tempSelections - platform
                                    } else {
                                        tempSelections + platform
                                    }
                                }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Checkbox(
                                checked = tempSelections.contains(platform),
                                onCheckedChange = { checked ->
                                    tempSelections = if (checked) {
                                        tempSelections + platform
                                    } else {
                                        tempSelections - platform
                                    }
                                }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = platform, style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onUpdatePlatforms(tempSelections.toList())
                        showPlatformEditDialog = false
                    },
                    enabled = tempSelections.isNotEmpty()
                ) {
                    Text(text = stringResource(R.string.continue_btn))
                }
            },
            dismissButton = {
                TextButton(onClick = { showPlatformEditDialog = false }) {
                    Text(text = stringResource(R.string.cancel))
                }
            }
        )
    }
}

@Composable
private fun ProfileDetailRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
        Text(text = value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = OnSurface)
    }
}

// Previews for all 4 states
@Preview(showBackground = true, name = "ProfileScreen Loading")
@Composable
fun ProfileScreenPreviewLoading() {
    ProfileScreen(uiState = UiState.Loading)
}

@Preview(showBackground = true, name = "ProfileScreen Error")
@Composable
fun ProfileScreenPreviewError() {
    ProfileScreen(uiState = UiState.Error("Could not reach the server, showing saved data instead"))
}

@Preview(showBackground = true, name = "ProfileScreen Empty")
@Composable
fun ProfileScreenPreviewEmpty() {
    ProfileScreen(uiState = UiState.Empty)
}

@Preview(showBackground = true, name = "ProfileScreen Populated")
@Composable
fun ProfileScreenPreviewPopulated() {
    ProfileScreen(uiState = UiState.Success(MockData.mockPrivacyRecord))
}
