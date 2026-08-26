package com.onshift.app

import android.app.Application
import android.util.Log
import com.onshift.app.data.api.BackendApiClient

class OnShiftApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Configure API client with backend URL from local.properties (via BuildConfig).
        // To point at a physical device's backend: edit BACKEND_BASE_URL in local.properties.
        BackendApiClient.configure(BuildConfig.BACKEND_BASE_URL)
        Log.d("OnShiftApp", "Backend URL: ${BuildConfig.BACKEND_BASE_URL}")
        // Initialize local encrypted vault / Room DB
    }
}
