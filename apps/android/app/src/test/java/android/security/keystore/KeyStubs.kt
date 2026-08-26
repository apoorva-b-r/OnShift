package android.security.keystore

import java.security.spec.AlgorithmParameterSpec

class KeyGenParameterSpec : AlgorithmParameterSpec {
    class Builder(alias: String, purpose: Int) {
        fun setBlockModes(vararg modes: String): Builder = this
        fun setEncryptionPaddings(vararg paddings: String): Builder = this
        fun setKeySize(size: Int): Builder = this
        fun setRandomizedEncryptionRequired(req: Boolean): Builder = this
        fun build(): KeyGenParameterSpec = KeyGenParameterSpec()
    }
}

object KeyProperties {
    const val PURPOSE_ENCRYPT = 1
    const val PURPOSE_DECRYPT = 2
    const val BLOCK_MODE_GCM = "GCM"
    const val ENCRYPTION_PADDING_NONE = "NoPadding"
    const val KEY_ALGORITHM_AES = "AES"
}
