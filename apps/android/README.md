# OnShift Android Application Scaffold

Worker-facing Android application built with Kotlin and Jetpack Compose.

## Key Modules
- **`notifications/`**: `NotificationListenerService` & modular parsers (`ZomatoParser`, `SwiggyParser`, `UberParser`, `GenericParser`).
- **`data/vault/`**: `EvidenceRepository` interface and `LocalEncryptedEvidenceRepository` using Android Keystore / EncryptedSharedPreferences.
- **`data/hashchain/`**: `HashChain` tamper-evident engine (`SHA256(currentRecord + previousHash)`) with `verifyHashChain()` verification.
- **`data/aa/`**: `AccountAggregatorProvider` interface and `MockAccountAggregatorProvider` sandbox flow.
- **`ui/screens/`**: Jetpack Compose placeholder screens (Identity, Home, Evidence, Reconciliation, Verification, Privacy, Selective Disclosure, Credential, Government Schemes).

## Building
Open `apps/android` in Android Studio or run `./gradlew build`.
