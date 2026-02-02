package com.issieboardng

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Native Package for Keyboard Preview
 * 
 * Registers the KeyboardPreviewView native component with React Native
 */
class KeyboardPreviewPackage : ReactPackage {
    
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        // No native modules, just view managers
        return emptyList()
    }
    
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return listOf(
            KeyboardPreviewViewManager(reactContext)
        )
    }
}