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
   * Set the keyboard configuration as JSON string
   */
  async setKeyboardConfig(configJSON: string): Promise<SetResult> {
    if (!KeyboardPreferencesModule) {
      return { success: false, error: 'Native module not available' };
    }
    return KeyboardPreferencesModule.setKeyboardConfig(configJSON);
  }

  /**
   * Set the keyboard configuration from object
   */
  async setKeyboardConfigObject(config: any): Promise<SetResult> {
    const configJSON = JSON.stringify(config);
    return this.setKeyboardConfig(configJSON);
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
