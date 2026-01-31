/**
 * AppNavigator - Simple navigation wrapper for the Keyboard Studio app
 * 
 * Provides navigation between:
 * - Legacy JSON-based configuration screen (default for now)
 * - New Visual Editor screen (Phase 1)
 * 
 * This uses simple state-based navigation to avoid adding new dependencies.
 * Can be upgraded to react-navigation later if needed.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { EditorScreen } from './screens/EditorScreen';
import KeyboardPreferences from './native/KeyboardPreferences';

type LanguageId = 'he' | 'en' | 'ar';

type Screen = 
  | { type: 'legacy' }
  | { type: 'editor'; profileId?: string; initialLanguage?: LanguageId };

// Map keyboard IDs to language IDs
const keyboardToLanguage: Record<string, LanguageId> = {
  'he': 'he',
  'he_ordered': 'he',
  'en': 'en',
  'ar': 'ar',
};

export const AppNavigator: React.FC = () => {
  // Start with the new Editor screen by default
  const [currentScreen, setCurrentScreen] = useState<Screen>({ type: 'editor' });
  const [initialLanguage, setInitialLanguage] = useState<LanguageId | undefined>(undefined);
  const [initialLoaded, setInitialLoaded] = useState(false);
  // Key to force EditorScreen to remount when opened from keyboard
  const [editorKey, setEditorKey] = useState(0);

  // Load initial language from preferences (set by keyboard when opening settings)
  useEffect(() => {
    const loadInitialSettings = async () => {
      try {
        // Check if there's a "launch_keyboard" preference set by the keyboard
        // Note: keyboard saves with setString (no prefix), so we need a matching read method
        // For now, use getProfile with profile_ prefix workaround, but we should use getString
        // The keyboard saves to "launch_keyboard" directly, but getProfile reads "profile_launch_keyboard"
        // FIXED: We need to read from the actual key, not with prefix
        
        // Try to get via native module directly - getString reads without prefix
        const { NativeModules } = require('react-native');
        const { KeyboardPreferencesModule } = NativeModules;
        let launchKeyboardId: string | null = null;
        
        if (KeyboardPreferencesModule?.getString) {
          try {
            launchKeyboardId = await KeyboardPreferencesModule.getString('launch_keyboard');
            console.log(`📱 AppNavigator: launch_keyboard from getString: ${launchKeyboardId || 'null'}`);
          } catch (e) {
            console.warn('getString failed:', e);
          }
        }
        
        if (launchKeyboardId) {
          const lang = keyboardToLanguage[launchKeyboardId] || 'he';
          console.log(`📱 AppNavigator: Opening with keyboard=${launchKeyboardId}, language=${lang}`);
          setInitialLanguage(lang);
          
          // Clear the launch_keyboard so next normal app launch doesn't use it
          if (KeyboardPreferencesModule?.setString) {
            await KeyboardPreferencesModule.setString('', 'launch_keyboard');
          }
        }
        
        // Also check for current_language as fallback
        if (!launchKeyboardId) {
          const currentLang = await KeyboardPreferences.getProfile('current_language');
          if (currentLang && ['he', 'en', 'ar'].includes(currentLang)) {
            setInitialLanguage(currentLang as LanguageId);
          }
        }
      } catch (error) {
        console.warn('Failed to load initial settings:', error);
      } finally {
        setInitialLoaded(true);
      }
    };
    
    loadInitialSettings();
    
    // Also handle deep links
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      console.log(`📱 AppNavigator: Deep link received: ${url}`);
      
      // Parse URL for language parameter
      // Format: issieboardng://settings?lang=he or issieboardng://settings?keyboard=he_ordered
      try {
        // Parse query string manually since URL.searchParams may not work in RN
        const queryIndex = url.indexOf('?');
        if (queryIndex !== -1) {
          const queryString = url.substring(queryIndex + 1);
          const params: Record<string, string> = {};
          queryString.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value) {
              params[decodeURIComponent(key)] = decodeURIComponent(value);
            }
          });
          
          const lang = params['lang'] as LanguageId;
          const keyboard = params['keyboard'];
          
          if (lang && ['he', 'en', 'ar'].includes(lang)) {
            console.log(`📱 AppNavigator: Setting language from deep link: ${lang}`);
            setInitialLanguage(lang);
            setEditorKey(prev => prev + 1); // Force remount
            setCurrentScreen({ type: 'editor' });
          } else if (keyboard) {
            const mappedLang = keyboardToLanguage[keyboard] || 'he';
            console.log(`📱 AppNavigator: Setting language from keyboard: ${keyboard} -> ${mappedLang}`);
            setInitialLanguage(mappedLang);
            setEditorKey(prev => prev + 1); // Force remount
            setCurrentScreen({ type: 'editor' });
          }
        }
      } catch {
        // URL parsing failed, ignore
      }
    };
    
    // Check for initial URL (app opened via deep link)
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink({ url });
      }
    });
    
    // Listen for deep link events while app is running
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => {
      subscription.remove();
    };
  }, []);

  const navigateToEditor = useCallback((profileId?: string) => {
    setCurrentScreen({ type: 'editor', profileId });
  }, []);

  const navigateToLegacy = useCallback(() => {
    setCurrentScreen({ type: 'legacy' });
  }, []);

  // Don't render until initial settings are loaded
  if (!initialLoaded) {
    return <View style={styles.container} />;
  }

  const profileId = currentScreen.type === 'editor' ? currentScreen.profileId : undefined;

  return (
    <View style={styles.container}>
      <EditorScreen 
        key={editorKey}
        profileId={profileId}
        initialLanguage={initialLanguage}
        onBack={navigateToLegacy}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AppNavigator;