package com.onshift.app.notifications

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.googlecode.tesseract.android.TessBaseAPI
import java.io.File
import java.io.FileOutputStream

enum class PlatformType {
    ZOMATO, SWIGGY, UBER, UNKNOWN
}

data class ParsedEvidence(
    val platform: PlatformType,
    val amount: Double?
)

data class OcrScanResult(
    val success: Boolean,
    val text: String,
    val evidence: ParsedEvidence?
)

object TesseractOcrScanner {

    fun scanAndParseDocument(context: Context, uri: Uri): OcrScanResult {
        return try {
            val text = extractText(context, uri)
            val evidence = parseSlipText(text)
            OcrScanResult(
                success = evidence.amount != null,
                text = text,
                evidence = evidence
            )
        } catch (e: Exception) {
            OcrScanResult(
                success = false,
                text = e.localizedMessage ?: "OCR Failed",
                evidence = null
            )
        }
    }

    private fun extractText(context: Context, uri: Uri): String {
        val dataPath = File(context.filesDir, "tesseract")
        val tessdataDir = File(dataPath, "tessdata")
        if (!tessdataDir.exists()) tessdataDir.mkdirs()

        val trainedDataFile = File(tessdataDir, "eng.traineddata")
        if (!trainedDataFile.exists()) {
            context.assets.open("tessdata/eng.traineddata").use { input ->
                FileOutputStream(trainedDataFile).use { output ->
                    input.copyTo(output)
                }
            }
        }

        val tess = TessBaseAPI()
        tess.init(dataPath.absolutePath, "eng")

        val mimeType = context.contentResolver.getType(uri) ?: ""
        val textResult = if (mimeType.contains("pdf", ignoreCase = true) || uri.toString().endsWith(".pdf", true)) {
            val pfd: ParcelFileDescriptor = context.contentResolver.openFileDescriptor(uri, "r") ?: return ""
            val renderer = PdfRenderer(pfd)
            val sb = StringBuilder()
            for (i in 0 until renderer.pageCount) {
                val page = renderer.openPage(i)
                val bitmap = Bitmap.createBitmap(page.width * 2, page.height * 2, Bitmap.Config.ARGB_8888)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                page.close()
                tess.setImage(bitmap)
                sb.append(tess.utF8Text ?: "").append("\n")
                tess.clear()
            }
            renderer.close()
            pfd.close()
            sb.toString()
        } else {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return ""
            val bitmap = BitmapFactory.decodeStream(inputStream) ?: return ""
            tess.setImage(bitmap)
            val txt = tess.utF8Text ?: ""
            tess.clear()
            txt
        }

        tess.recycle()
        return textResult
    }

    private fun parseSlipText(text: String): ParsedEvidence {
        val upper = text.uppercase()
        val platform = when {
            upper.contains("ZOMATO") -> PlatformType.ZOMATO
            upper.contains("SWIGGY") -> PlatformType.SWIGGY
            upper.contains("UBER") -> PlatformType.UBER
            else -> PlatformType.UNKNOWN
        }

        // Regex to locate earnings/payout amounts (e.g. ₹250.00, Rs 300, 450.50)
        val regex = Regex("""(?:[₹RSrs\.\s])\s*(\d+(?:\.\d{1,2})?)""")
        val match = regex.find(text)
        val amount = match?.groupValues?.get(1)?.toDoubleOrNull()

        return ParsedEvidence(platform = platform, amount = amount)
    }
}