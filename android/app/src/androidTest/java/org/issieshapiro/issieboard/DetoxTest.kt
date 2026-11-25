package org.issieshapiro.issieboard

import android.app.Activity
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.filters.LargeTest
import androidx.test.rule.ActivityTestRule
import com.wix.detox.Detox
import com.wix.detox.config.DetoxConfig
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

// Runs the Detox e2e tests (e2e/*.test.ts) on Android
@RunWith(AndroidJUnit4::class)
@LargeTest
class DetoxTest {
    // (by name: the app's MainActivity does not resolve when this test compiles)
    @Suppress("UNCHECKED_CAST")
    @get:Rule
    val activityRule = ActivityTestRule(
        Class.forName("org.issieshapiro.issieboard.MainActivity") as Class<Activity>, false, false)

    @Test
    fun runDetoxTests() {
        val detoxConfig = DetoxConfig()
        detoxConfig.idlePolicyConfig.masterTimeoutSec = 90
        detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = 60
        detoxConfig.rnContextLoadTimeoutSec = 180
        Detox.runTests(activityRule, detoxConfig)
    }
}
