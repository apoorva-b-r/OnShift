package com.onshift.app.data.model

import com.onshift.app.R

object MockData {
    val zeroStateWorker = Worker(
        id = "OS-000000",
        verificationLevel = VerificationLevel.DECLARED
    )

    val reconciledStateWorker = Worker(
        id = "OS-82F91A",
        verificationLevel = VerificationLevel.FINANCIALLY_CORROBORATED
    )

    val scenarioMatched = ReconciliationResult(
        expected = 30100.0,
        actual = 30100.0,
        status = ReconciliationStatus.MATCHED,
        differenceAmount = 0.0,
        period = "July 2026"
    )

    val scenarioUnexplainedDifference = ReconciliationResult(
        expected = 30100.0,
        actual = 29500.0,
        status = ReconciliationStatus.UNEXPLAINED_DIFFERENCE,
        differenceAmount = 600.0,
        period = "July 2026"
    )

    val mixedEvidence = listOf(
        Evidence("EV-001", "Zomato", EvidenceType.OBSERVED, "2026-07-01", 1200.0),
        Evidence("EV-002", "Swiggy", EvidenceType.OBSERVED, "2026-07-05", 850.0),
        Evidence("EV-003", "Blinkit", EvidenceType.OBSERVED, "2026-07-10", 2100.0),
        Evidence("EV-004", "Bank AA", EvidenceType.FINANCIAL, "2026-07-31", 30100.0),
        Evidence("EV-005", "Uploaded document", EvidenceType.DECLARED, "2026-07-15", 2400.0)
    )

    val mockVerificationResult = VerificationResult(
        level = VerificationLevel.FINANCIALLY_CORROBORATED,
        confidenceScore = 0.96,
        explanation = "Income matches bank settlement credit via Account Aggregator flow within an acceptable margin across the last reconciliation period."
    )

    val mockCredential = Credential(
        workerId = "OS-82F91A",
        period = "July 2026",
        verifiedIncome = 30100.0,
        verificationLevel = VerificationLevel.FINANCIALLY_CORROBORATED,
        signaturePreview = "0x7d...a1b",
        includedClaims = listOf("Name", "Verified Income", "Period")
    )

    val mockSchemeMatches = listOf(
        SchemeMatch(R.string.scheme_pm_svanidhi_name, R.string.scheme_pm_svanidhi_desc, true),
        SchemeMatch(R.string.scheme_ayushman_bharat_name, R.string.scheme_ayushman_bharat_desc, true),
        SchemeMatch(R.string.scheme_eshram_name, R.string.scheme_eshram_desc, true)
    )

    val mockPrivacyRecord = PrivacyRecord(
        hashChainValid = true,
        lastVerifiedAt = "2026-08-20T10:00:00Z"
    )
}
