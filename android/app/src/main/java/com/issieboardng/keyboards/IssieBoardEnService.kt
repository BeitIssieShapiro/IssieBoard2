package com.issieboardng.keyboards

import com.issieboardng.shared.BaseKeyboardService

/**
 * English Keyboard Service
 * Port of ios/IssieBoardEn/KeyboardViewController.swift
 * 
 * Inherits from BaseKeyboardService and configures itself for English.
 * The keyboard language is used to load the appropriate configuration.
 */
class IssieBoardEnService : BaseKeyboardService() {
    
    override val keyboardLanguage: String = "en"
    
    override val defaultConfigFileName: String = "en_config"
}
