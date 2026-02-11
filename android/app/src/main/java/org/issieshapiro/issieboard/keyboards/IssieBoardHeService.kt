package org.issieshapiro.issieboard.keyboards

import org.issieshapiro.issieboard.shared.BaseKeyboardService

/**
 * Hebrew Keyboard Service
 * Port of ios/IssieBoardHe/KeyboardViewController.swift
 * 
 * Inherits from BaseKeyboardService and configures itself for Hebrew.
 * The keyboard language is used to load the appropriate configuration.
 */
class IssieBoardHeService : BaseKeyboardService() {
    
    override val keyboardLanguage: String = "he"
    
    override val defaultConfigFileName: String = "he_config"
}
