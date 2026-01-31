import { NativeModules } from 'react-native';

const { KeyboardPreferencesModule } = NativeModules;

// Check if native module is available
if (!KeyboardPreferencesModule) {
  console.warn('⚠️ KeyboardPreferencesModule not found. Make sure you:');
  console.warn('1. Added KeyboardPreferencesModule.swift and .m to Xcode');
  console.warn('2. Enabled App Groups capability in both targets');
  console.warn('3. Rebuilt the iOS app');
  console.warn('Falling back to stub implementation...');
}

export interface PreferenceInfo {
  appGroup: string;
  currentProfile: string | null;
  selectedLanguage: string | null;
  lastUpdateTime: number;
  hasConfig: boolean;
}

export interface SetResult {
  success: boolean;
  [key: string]: any;
}

/**
 * iOS Keyboard Preferences Manager
 * 
 * This module provides methods to share preferences between the React Native app
 * and the iOS keyboard extension using App Groups.
 */
class KeyboardPreferences {
  
  /**
   * Set the current keyboard profile
   */
  async setCurrentProfile(profile: string): Promise<SetResult> {
    if (!KeyboardPreferencesModule) {
      return { success: false, error: 'Native module not available' };
    }
    return KeyboardPreferencesModule.setCurrentProfile(profile);
  }

  /**
   * Get the current keyboard profile
   */
  async getCurrentProfile(): Promise<string | null> {
    if (!KeyboardPreferencesModule) {
      return null;
    }
    return KeyboardPreferencesModule.getCurrentProfile();
  }

  /**
   * Set the selected keyboard language
   */
  async setSelectedLanguage(language: string): Promise<SetResult> {
    if (!KeyboardPreferencesModule) {
      return { success: false, error: 'Native module not available' };
    }
    return KeyboardPreferencesModule.setSelectedLanguage(language);
  }

  /**
   * Get the selected keyboard language
   */
  async getSelectedLanguage(): Promise<string | null> {
    if (!KeyboardPreferencesModule) {
      return null;
    }
    return KeyboardPreferencesModule.getSelectedLanguage();
  }

  /**
   * Set the keyboard configuration as JSON string (global - affects all keyboards)
   * @deprecated Use setKeyboardConfigForLanguage instead for language-specific configs
   */
  async setKeyboardConfig(configJSON: string): Promise<SetResult> {
    if (!KeyboardPreferencesModule) {
      return { success: false, error: 'Native module not available' };
    }
    return KeyboardPreferencesModule.setKeyboardConfig(configJSON);
  }

  /**
   * Set the keyboard configuration for a specific language/keyboard
   * This saves directly to keyboardConfig_{keyboardId} which each keyboard extension reads
   * Note: Uses setKeyboardConfig's underlying native method but with a custom key
   */
  async setKeyboardConfigForLanguage(configJSON: string, keyboardId: string): Promise<SetResult> {
    if (!KeyboardPreferencesModule) {
      return { success: false, error: 'Native module not available' };
    }
    // Use setString to save directly without "profile_" prefix
    // The iOS keyboard reads using preferences.getString(forKey: "keyboardConfig_\(keyboardLanguage)")
    return KeyboardPreferencesModule.setString(configJSON, `keyboardConfig_${keyboardId}`);
  }

  /**
   * Set the keyboard configuration from object (global - affects all keyboards)
   * @deprecated Use setKeyboardConfigObjectForLanguage instead
   */
  async setKeyboardConfigObject(config: any): Promise<SetResult> {
    const configJSON = JSON.stringify(config);
    return this.setKeyboardConfig(configJSON);
  }

  /**
   * Set the keyboard configuration from object for a specific language
   */
  async setKeyboardConfigObjectForLanguage(config: any, language: string): Promise<SetResult> {
    const configJSON = JSON.stringify(config);
    return this.setKeyboardConfigForLanguage(configJSON, language);
  }

  /**
   * Get the keyboard configuration as JSON string
   */
  async getKeyboardConfig(): Promise<string | null> {
    if (!KeyboardPreferencesModule) {
      return null;
    }
    return KeyboardPreferencesModule.getKeyboardConfig();
  }

  /**
   * Get the keyboard configuration as object
   */
  async getKeyboardConfigObject(): Promise<any | null> {
    const configJSON = await this.getKeyboardConfig();
    if (configJSON) {
      try {
        return JSON.parse(configJSON);
      } catch (error) {
        console.error('Failed to parse keyboard config:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Set a profile configuration
   */
  async setProfile(profileJSON: string, key: string): Promise<SetResult> {
    if (!KeyboardPreferencesModule) {
      return { success: false, error: 'Native module not available' };
    }
    return KeyboardPreferencesModule.setProfile(profileJSON, key);
  }

  /**
   * Set a profile configuration from object
   */
  async setProfileObject(profile: any, key: string): Promise<SetResult> {
    const profileJSON = JSON.stringify(profile);
    return this.setProfile(profileJSON, key);
  }

  /**
   * Get a profile configuration
   */
  async getProfile(key: string): Promise<string | null> {
    if (!KeyboardPreferencesModule) {
      return null;
    }
    return KeyboardPreferencesModule.getProfile(key);
  }

  /**
   * Get a profile configuration as object
   */
  async getProfileObject(key: string): Promise<any | null> {
    const profileJSON = await this.getProfile(key);
    if (profileJSON) {
      try {
        return JSON.parse(profileJSON);
      } catch (error) {
        console.error('Failed to parse profile:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Print all preferences to console (for debugging)
   */
  async printAllPreferences(): Promise<PreferenceInfo> {
    if (!KeyboardPreferencesModule) {
      return {
        appGroup: 'N/A - Module not loaded',
        currentProfile: null,
        selectedLanguage: null,
        lastUpdateTime: 0,
        hasConfig: false,
      };
    }
    return KeyboardPreferencesModule.printAllPreferences();
  }

  /**
   * Clear all preferences
   */
  async clearAll(): Promise<SetResult> {
    if (!KeyboardPreferencesModule) {
      return { success: false, error: 'Native module not available' };
    }
    return KeyboardPreferencesModule.clearAll();
  }

  /**
   * Clear the keyboard configuration only (for testing bootstrap)
   * This allows the keyboard extension to fall back to its bundled default config
   * 
   * Note: Implemented in TypeScript by setting an empty config string.
   * The native keyboard should check for empty/null config and use defaults.
   */
  async clearKeyboardConfig(): Promise<SetResult> {
    if (!KeyboardPreferencesModule) {
      return { success: false, error: 'Native module not available' };
    }
    // Use setKeyboardConfig with empty string to clear the config
    // The native keyboard should detect empty config and fall back to defaults
    try {
      await KeyboardPreferencesModule.setKeyboardConfig('');
      return { success: true };
    } catch (error) {
      console.error('Failed to clear keyboard config:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get the App Group identifier
   */
  async getAppGroupIdentifier(): Promise<string> {
    if (!KeyboardPreferencesModule) {
      return 'N/A - Module not loaded';
    }
    return KeyboardPreferencesModule.getAppGroupIdentifier();
  }
}

export default new KeyboardPreferences();
