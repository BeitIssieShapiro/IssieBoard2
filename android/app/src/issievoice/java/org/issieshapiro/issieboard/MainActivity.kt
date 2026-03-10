package org.issieshapiro.issieboard

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * MainActivity for IssieVoice app
 * Returns "IssieVoice" as the main component name to load the IssieVoice React Native app
 *
 * Screen orientation:
 * - Phones (small/normal): Portrait only
 * - Tablets (large/xlarge): All orientations
 */
class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Set screen orientation based on device size
    // Tablets (sw600dp+) get all orientations, phones get portrait only
    val screenLayout = resources.configuration.screenLayout and Configuration.SCREENLAYOUT_SIZE_MASK
    requestedOrientation = when (screenLayout) {
      Configuration.SCREENLAYOUT_SIZE_LARGE,
      Configuration.SCREENLAYOUT_SIZE_XLARGE -> {
        // Tablets: allow all orientations
        ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
      }
      else -> {
        // Phones: portrait only
        ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
      }
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript.
   * This loads the IssieVoice app instead of IssieBoardNG.
   */
  override fun getMainComponentName(): String = "IssieVoice"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
