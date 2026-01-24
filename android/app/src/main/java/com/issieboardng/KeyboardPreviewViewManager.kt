package com.issieboardng

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * ViewManager for KeyboardPreviewView
 * Bridges the native Android keyboard preview to React Native
 */
class KeyboardPreviewViewManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<KeyboardPreviewView>() {

    override fun getName() = "KeyboardPreviewView"

    override fun createViewInstance(reactContext: ThemedReactContext): KeyboardPreviewView {
        return KeyboardPreviewView(reactContext)
    }

    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        return MapBuilder.of(
            "onKeyPress",
            MapBuilder.of("registrationName", "onKeyPress")
        )
    }

    @ReactProp(name = "configJson")
    fun setConfigJson(view: KeyboardPreviewView, configJson: String?) {
        view.setConfigJson(configJson)
    }
}
