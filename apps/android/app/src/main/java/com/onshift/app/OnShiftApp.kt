package com.onshift.app

import android.app.Application
import com.onshift.app.data.vault.LocalEncryptedEvidenceRepository

class OnShiftApp : Application() {
    /** One process-wide repository keeps listener writes on the same encrypted hash chain as the UI. */
    val evidenceRepository by lazy { LocalEncryptedEvidenceRepository.createInstance(this) }

    override fun onCreate() {
        super.onCreate()
        evidenceRepository
    }
}
