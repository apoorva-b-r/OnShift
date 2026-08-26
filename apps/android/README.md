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

## Physical Android Phone Testing (LAN / Local Wi-Fi)

To test the app and Mock AA consent flow from a physical Android device on the same local Wi-Fi:

1. **Find your laptop's LAN IP**:
   - Windows: Run `ipconfig` in PowerShell/CMD and locate the **IPv4 Address** of your Wi-Fi adapter (e.g. `192.168.1.42`).
   - macOS/Linux: Run `ifconfig` or `ip a` (e.g. `192.168.1.42`).

2. **Configure `local.properties`**:
   - Copy `local.properties.example` to `local.properties` (or edit `local.properties`).
   - Set your laptop LAN IP:
     ```properties
     BACKEND_BASE_URL=http://192.168.1.42:4000/api/v1
     ```
   - Note: `local.properties` is gitignored so your personal IP will never be committed to GitHub.

3. **Ensure Phone and Laptop are on the same Wi-Fi network**.

4. **Start the Backend**:
   ```bash
   cd apps/backend
   npm run dev
   ```

5. **Test the Mock AA Consent Flow**:
   - Launch the Android app on your physical device.
   - Initiate financial verification / consent request.
   - The app receives a `consentUrl` using your laptop's LAN IP (e.g. `http://192.168.1.42:4000/api/v1/mock-aa/consent/mock-consent-...`).
   - Phone opens the authorization page in Chrome $\rightarrow$ Select FIP $\rightarrow$ Enter OTP `123456` $\rightarrow$ Tap **Approve**.
   - Consent status updates to `ACTIVE` in MongoDB and the evidence pipeline continues.

