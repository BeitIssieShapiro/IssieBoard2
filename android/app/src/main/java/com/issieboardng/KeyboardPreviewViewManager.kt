package com.issieboardng

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

/**
 * React Native ViewManager for KeyboardPreviewView
 * Port of ios/IssieBoardNG/KeyboardPreviewViewManager.swift
 * 
 * Exposes the native KeyboardPreviewView to React Native as 'KeyboardPreviewView'
 */
class KeyboardPreviewViewManager(
    private val reactContext: ReactApplicationContext
) : SimpleViewManager<KeyboardPreviewView>() {
    
    companion object {
        const val REACT_CLASS = "KeyboardPreviewView"
    }
    
    override fun getName(): String = REACT_CLASS
    
    override fun createViewInstance(context: ThemedReactContext): KeyboardPreviewView {
        return KeyboardPreviewView(context)
    }
    
    /**
     * Set the keyboard configuration JSON
     */
    @ReactProp(name = "configJson")
    fun setConfigJson(view: KeyboardPreviewView, configJson: String?) {
        view.setConfigJson(configJson)
    }
    
    /**
     * Set selected key IDs for visual highlighting
     * @param selectedKeys JSON array string, e.g., '["abc:0:3", "abc:1:2"]'
     */
    @ReactProp(name = "selectedKeys")
    fun setSelectedKeys(view: KeyboardPreviewView, selectedKeys: String?) {
        view.setSelectedKeys(selectedKeys)
    }
    
    /**
     * Export event names that this view can emit
     */
    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any>? {
        return MapBuilder.builder<String, Any>()
            .put("onKeyPress", MapBuilder.of("registrationName", "onKeyPress"))
            .build()
    }
}