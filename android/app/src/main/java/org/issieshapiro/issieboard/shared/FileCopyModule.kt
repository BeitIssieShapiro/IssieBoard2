package org.issieshapiro.issieboard.shared

import android.content.ContentResolver
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class FileCopyModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "FileCopyModule"

    @ReactMethod
    fun copyContentUriToTemp(contentUri: String, promise: Promise) {
        try {
            val uri = Uri.parse(contentUri)
            val contentResolver: ContentResolver = reactContext.contentResolver
            val inputStream: InputStream? = contentResolver.openInputStream(uri)
            if (inputStream == null) {
                promise.reject("E_NO_INPUT_STREAM", "Could not open input stream from URI")
                return
            }

            val fileName = "shared_${System.currentTimeMillis()}.zip"
            val tempFile = File(reactContext.cacheDir, fileName)
            val outputStream: OutputStream = FileOutputStream(tempFile)

            val buffer = ByteArray(1024)
            var length: Int
            while (inputStream.read(buffer).also { length = it } > 0) {
                outputStream.write(buffer, 0, length)
            }

            outputStream.flush()
            outputStream.close()
            inputStream.close()

            promise.resolve(tempFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("E_COPY_FAILED", "Failed to copy content URI to temp file", e)
        }
    }
}
