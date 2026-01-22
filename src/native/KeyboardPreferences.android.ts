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
      await DefaultPreference.setName('keyboard_data');
      await DefaultPreference.set('selected_profile', profile);
      return { success: true, profile };
    } catch (error) {
      console.error('Android: Failed to set current profile', error);
      return { success: false, error };
    }
  }

  async getCurrentProfile(): Promise<string | null> {
    try {
      await DefaultPreference.setName('keyboard_data');
      const value = await DefaultPreference.get('selected_profile');
      return value || null;
    } catch (error) {
      console.error('Android: Failed to get current profile', error);
      return null;
    }
  }

  async setSelectedLanguage(language: string): Promise<SetResult> {
    try {
      await DefaultPreference.setName('keyboard_data');
      await DefaultPreference.set('selected_language', language);
      return { success: true, language };
    } catch (error) {
      console.error('Android: Failed to set language', error);
      return { success: false, error };
    }
  }

  async getSelectedLanguage(): Promise<string | null> {
    try {
      await DefaultPreference.setName('keyboard_data');
      const value = await DefaultPreference.get('selected_language');
      return value || null;
    } catch (error) {
      console.error('Android: Failed to get language', error);
      return null;
    }
  }

  async setKeyboardConfig(configJSON: string): Promise<SetResult> {
    try {
      await DefaultPreference.setName('keyboard_data');
      await DefaultPreference.set('config_json', configJSON);
      return { 
        success: true,
        timestamp: Date.now(),
        length: configJSON.length
      };
    } catch (error) {
      console.error('Android: Failed to set keyboard config', error);
      return { success: false, error };
    }
  }

  async setKeyboardConfigObject(config: any): Promise<SetResult> {
    const configJSON = JSON.stringify(config);
    return this.setKeyboardConfig(configJSON);
  }

  async getKeyboardConfig(): Promise<string | null> {
    try {
      await DefaultPreference.setName('keyboard_data');
      const value = await DefaultPreference.get('config_json');
      return value || null;
    } catch (error) {
      console.error('Android: Failed to get keyboard config', error);
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
      await DefaultPreference.setName('keyboard_data');
      await DefaultPreference.set(`profile_${key}`, profileJSON);
      return { success: true, key };
    } catch (error) {
      console.error('Android: Failed to set profile', error);
      return { success: false, error };
    }
  }

  async setProfileObject(profile: any, key: string): Promise<SetResult> {
    const profileJSON = JSON.stringify(profile);
    return this.setProfile(profileJSON, key);
  }

  async getProfile(key: string): Promise<string | null> {
    try {
      await DefaultPreference.setName('keyboard_data');
      const value = await DefaultPreference.get(`profile_${key}`);
      return value || null;
    } catch (error) {
      console.error('Android: Failed to get profile', error);
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

  async printAllPreferences(): Promise<PreferenceInfo> {
    const profile = await this.getCurrentProfile();
    const language = await this.getSelectedLanguage();
    const hasConfig = !!(await this.getKeyboardConfig());
    
    const info: PreferenceInfo = {
      appGroup: 'SharedPreferences (keyboard_data)',
      currentProfile: profile,
      selectedLanguage: language,
      lastUpdateTime: Date.now() / 1000,
      hasConfig,
    };
    
    console.log('📱 Android Keyboard Preferences:');
    console.log('  Storage: SharedPreferences');
    console.log('  Current Profile:', profile || 'none');
    console.log('  Selected Language:', language || 'none');
    console.log('  Has Config:', hasConfig);
    
    return info;
  }

  async clearAll(): Promise<SetResult> {
    try {
      await DefaultPreference.setName('keyboard_data');
      await DefaultPreference.clearAll();
      return { success: true };
    } catch (error) {
      console.error('Android: Failed to clear preferences', error);
      return { success: false, error };
    }
  }

  async getAppGroupIdentifier(): Promise<string> {
    return 'SharedPreferences (keyboard_data)';
  }
}

export default new KeyboardPreferences();
