package org.issieshapiro.issieboard.keyboards

import org.issieshapiro.issieboard.shared.BaseKeyboardService

/**
 * Arabic Keyboard Service
 * Port of ios/IssieBoardAr/KeyboardViewController.swift
 * 
 * Inherits from BaseKeyboardService and configures itself for Arabic.
 * The keyboard language is used to load the appropriate configuration.
 */
class IssieBoardArService : BaseKeyboardService() {
    
    override val keyboardLanguage: String = "ar"
    
    override val defaultConfigFileName: String = "ar_config"
}
