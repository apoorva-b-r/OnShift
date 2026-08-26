package android.content

import java.io.File

open class Context {
    val noBackupFilesDir: File = File("build/vault_test")
}
