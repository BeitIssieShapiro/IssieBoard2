import DefaultPreference from 'react-native-default-preference';

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
 * Android Keyboard Preferences Manager
 * 
 * Uses react-native-default-preference (SharedPreferences) for Android keyboards.
 * Provides the same interface as iOS for cross-platform compatibility.
 */
class KeyboardPreferences {
  
  async setCurrentProfile(profile: string): Promise<SetResult> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      await DefaultPreference.set('currentProfile', profile);
      await DefaultPreference.set('lastUpdateTime', Date.now().toString());
      console.log('✅ Android: Set current profile:', profile);
      return { success: true, profile };
    } catch (error) {
      console.error('❌ Android: Failed to set current profile', error);
      return { success: false, error };
    }
  }

  async getCurrentProfile(): Promise<string | null> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      const value = await DefaultPreference.get('currentProfile');
      console.log('📖 Android: Get current profile:', value || 'null');
      return value || null;
    } catch (error) {
      console.error('❌ Android: Failed to get current profile', error);
      return null;
    }
  }

  async setSelectedLanguage(language: string): Promise<SetResult> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      await DefaultPreference.set('selectedLanguage', language);
      await DefaultPreference.set('lastUpdateTime', Date.now().toString());
      console.log('✅ Android: Set selected language:', language);
      return { success: true, language };
    } catch (error) {
      console.error('❌ Android: Failed to set language', error);
      return { success: false, error };
    }
  }

  async getSelectedLanguage(): Promise<string | null> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      const value = await DefaultPreference.get('selectedLanguage');
      console.log('📖 Android: Get selected language:', value || 'null');
      return value || null;
    } catch (error) {
      console.error('❌ Android: Failed to get language', error);
      return null;
    }
  }

  async setKeyboardConfig(configJSON: string): Promise<SetResult> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      await DefaultPreference.set('keyboardConfig', configJSON);
      await DefaultPreference.set('lastUpdateTime', Date.now().toString());
      console.log('✅ Android: Set keyboard config, length:', configJSON.length);
      return { 
        success: true,
        timestamp: Date.now(),
        length: configJSON.length
      };
    } catch (error) {
      console.error('❌ Android: Failed to set keyboard config', error);
      return { success: false, error };
    }
  }

  async setKeyboardConfigForLanguage(configJSON: string, keyboardId: string): Promise<SetResult> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      await DefaultPreference.set(`keyboardConfig_${keyboardId}`, configJSON);
      await DefaultPreference.set('lastUpdateTime', Date.now().toString());
      console.log('✅ Android: Set keyboard config for language:', keyboardId, 'length:', configJSON.length);
      return { 
        success: true,
        timestamp: Date.now(),
        length: configJSON.length,
        keyboardId
      };
    } catch (error) {
      console.error('❌ Android: Failed to set keyboard config for language', error);
      return { success: false, error };
    }
  }

  async setKeyboardConfigObject(config: any): Promise<SetResult> {
    const configJSON = JSON.stringify(config);
    return this.setKeyboardConfig(configJSON);
  }

  async setKeyboardConfigObjectForLanguage(config: any, keyboardId: string): Promise<SetResult> {
    const configJSON = JSON.stringify(config);
    return this.setKeyboardConfigForLanguage(configJSON, keyboardId);
  }

  async getKeyboardConfig(): Promise<string | null> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      const value = await DefaultPreference.get('keyboardConfig');
      console.log('📖 Android: Get keyboard config:', value ? `${value.length} chars` : 'null');
      return value || null;
    } catch (error) {
      console.error('❌ Android: Failed to get keyboard config', error);
      return null;
    }
  }

  async getKeyboardConfigObject(): Promise<any | null> {
    const configJSON = await this.getKeyboardConfig();
    if (configJSON) {
      try {
        return JSON.parse(configJSON);
      } catch (error) {
        console.error('Android: Failed to parse keyboard config', error);
        return null;
      }
    }
    return null;
  }

  async setProfile(profileJSON: string, key: string): Promise<SetResult> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      await DefaultPreference.set(`profile_${key}`, profileJSON);
      console.log('✅ Android: Set profile:', key, 'length:', profileJSON.length);
      return { success: true, key };
    } catch (error) {
      console.error('❌ Android: Failed to set profile', error);
      return { success: false, error };
    }
  }

  async setProfileObject(profile: any, key: string): Promise<SetResult> {
    const profileJSON = JSON.stringify(profile);
    return this.setProfile(profileJSON, key);
  }

  async getProfile(key: string): Promise<string | null> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      const value = await DefaultPreference.get(`profile_${key}`);
      console.log('📖 Android: Get profile:', key, value ? `${value.length} chars` : 'null');
      return value || null;
    } catch (error) {
      console.error('❌ Android: Failed to get profile', error);
      return null;
    }
  }

  async getProfileObject(key: string): Promise<any | null> {
    const profileJSON = await this.getProfile(key);
    if (profileJSON) {
      try {
        return JSON.parse(profileJSON);
      } catch (error) {
        console.error('Android: Failed to parse profile', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Get a string value without the profile_ prefix
   * Use this for reading keyboard configs that were saved with setString
   */
  async getString(key: string): Promise<string | null> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      const value = await DefaultPreference.get(key);
      console.log('📖 Android: Get string:', key, value ? `${value.length} chars` : 'null');
      return value || null;
    } catch (error) {
      console.error('❌ Android: Failed to get string', error);
      return null;
    }
  }

  async printAllPreferences(): Promise<PreferenceInfo> {
    const profile = await this.getCurrentProfile();
    const language = await this.getSelectedLanguage();
    const hasConfig = !!(await this.getKeyboardConfig());
    
    const info: PreferenceInfo = {
      appGroup: 'SharedPreferences (issieboard_keyboard_prefs)',
      currentProfile: profile,
      selectedLanguage: language,
      lastUpdateTime: Date.now() / 1000,
      hasConfig,
    };
    
    console.log('📱 Android Keyboard Preferences:');
    console.log('  Storage: SharedPreferences (issieboard_keyboard_prefs)');
    console.log('  Current Profile:', profile || 'none');
    console.log('  Selected Language:', language || 'none');
    console.log('  Has Config:', hasConfig);
    
    return info;
  }

  async clearAll(): Promise<SetResult> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      await DefaultPreference.clearAll();
      console.log('🗑️ Android: Cleared all preferences');
      return { success: true };
    } catch (error) {
      console.error('❌ Android: Failed to clear preferences', error);
      return { success: false, error };
    }
  }

  /**
   * Clear the keyboard configuration only (for testing bootstrap)
   * This allows the keyboard to fall back to its bundled default config
   */
  async clearKeyboardConfig(): Promise<SetResult> {
    try {
      await DefaultPreference.setName('issieboard_keyboard_prefs');
      await DefaultPreference.clear('keyboardConfig');
      console.log('🗑️ Android: Cleared keyboard config');
      return { success: true };
    } catch (error) {
      console.error('❌ Android: Failed to clear keyboard config', error);
      return { success: false, error };
    }
  }

  async getAppGroupIdentifier(): Promise<string> {
    return 'SharedPreferences (issieboard_keyboard_prefs)';
  }

  /**
   * Add listener for launch keyboard language changes
   * Triggered when app is opened from keyboard extension with a language parameter
   * Returns a subscription object with a remove() method
   *
   * Note: Android doesn't have the same URL scheme deep linking as iOS yet,
   * so this is a no-op for now but maintains API compatibility.
   */
  addLaunchKeyboardListener(callback: (language: string) => void): { remove: () => void } {
    // TODO: Implement deep linking from keyboard to app on Android
    console.log('📱 [KeyboardPreferences Android] addLaunchKeyboardListener called (not implemented yet)');
    return { remove: () => {} };
  }
}

export default new KeyboardPreferences();
