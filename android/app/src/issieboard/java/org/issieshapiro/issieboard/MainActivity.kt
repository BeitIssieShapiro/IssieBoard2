package org.issieshapiro.issieboard

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import java.io.File
import java.io.FileOutputStream

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "IssieBoardNG"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    intent = modifyIntentForSharing(intent)
    super.onCreate(savedInstanceState)
  }

  override fun onNewIntent(intent: Intent?) {
    val modifiedIntent = modifyIntentForSharing(intent)
    super.onNewIntent(modifiedIntent)
  }

  private fun copyContentUriToTempFile(uri: Uri): Uri? {
    try {
      val inputStream = contentResolver.openInputStream(uri) ?: return null
      val fileName = "shared_${System.currentTimeMillis()}.zip"
      val tempFile = File(cacheDir, fileName)
      FileOutputStream(tempFile).use { output ->
        inputStream.use { input ->
          input.copyTo(output)
        }
      }
      return Uri.fromFile(tempFile)
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "Failed to copy content URI to temp", e)
      return null
    }
  }

  private fun modifyIntentForSharing(intent: Intent?): Intent? {
    intent ?: return null

    val sharedUri: Uri? = if (Intent.ACTION_SEND == intent.action) {
      @Suppress("DEPRECATION")
      intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
    } else {
      intent.data
    }

    sharedUri?.let { uri ->
      val resolvedUri = if (uri.scheme == "content") {
        copyContentUriToTempFile(uri) ?: uri
      } else {
        uri
      }
      intent.data = resolvedUri
      intent.action = Intent.ACTION_VIEW
    }

    return intent
  }
}
