import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useText } from '../context/TextContext';
import { useTTS } from '../context/TTSContext';
import { useLocalization } from '../context/LocalizationContext';
import { useNotification } from '../context/NotificationContext';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets, useSafeAreaFrame } from 'react-native-safe-area-context';
import TextDisplayArea from '../components/TextDisplayArea/TextDisplayArea';
import SuggestionsBar from '../components/SuggestionsBar/SuggestionsBar';
import FavoritesBar from '../components/FavoritesBar/FavoritesBar';
import SettingsModal from '../components/SettingsModal/SettingsModal';
import { KeyboardPreview, KeyPressEvent } from '../../../../src/components/KeyboardPreview';
import { colors, sizes } from '../constants';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';
import { IVButton } from '../components/ActionBar/SpeakButton';

interface MainScreenProps {
  navigation: any;
}

const settingsKey = {
  type: 'event',  // Event-only key
  label: '☰',
  caption: '☰',
  value: 'SETTINGS',  // Event identifier
  width: 1,
  bgColor: '#888888',
  fontSizePreset: 'normal',
};

const clearAllKey = {
  type: 'event',  // Event-only key - doesn't modify text
  label: '🗑️',
  caption: '🗑️',
  value: 'CLEAR_ALL',  // Event identifier
  width: 1,
  bgColor: '#f44336',
  fontSizePreset: 'normal',
};

const MainScreen: React.FC<MainScreenProps> = ({ navigation }) => {
  const { currentText, setText, clearText } = useText();
  const { speak, setLanguage: setTTSLanguage } = useTTS();
  const { language: deviceLanguage, strings } = useLocalization();
  const { showNotification } = useNotification();
  const [keyboardConfig, setKeyboardConfig] = useState<string>('');
  const [kbSuggestions, setKbSuggestions] = useState<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(350);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'he'>(deviceLanguage);
  const [languageMode, setLanguageMode] = useState<'en-only' | 'he-only' | 'detect'>('detect');
  const [englishVoice, setEnglishVoice] = useState<string | undefined>(undefined);
  const [hebrewVoice, setHebrewVoice] = useState<string | undefined>(undefined);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [favoritesReloadTrigger, setFavoritesReloadTrigger] = useState(0);
  const keyboardConfigRef = useRef<any>(null);
  const keyboardHeightRef = useRef<number>(350);

  // Get window dimensions using useSafeAreaFrame (works with ScreenSizer)
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();

  const availableHeight = frame.height - insets.top - insets.bottom - keyboardHeight;

  // Determine if landscape or portrait
  const isLandscape = frame.width > frame.height;

  // Function to load keyboard configuration for a specific language
  const loadKeyboardConfig = async (language: string) => {
    console.log('🔄 Loading keyboard config for language:', language);
    try {
      // First, try to load the active profile for IssieVoice from preferences
      const activeProfileKey = `active_profile_issievoice_${language}`;
      const activeProfile = await KeyboardPreferences.getProfile(activeProfileKey);

      if (activeProfile) {
        // Load saved configuration from the active profile using app-specific key
        console.log(`📋 Loading saved config for IssieVoice from active profile: ${activeProfile}`);
        const configKey = `keyboardConfig_issievoice_${language}`;
        // Use getString instead of getProfile to avoid the profile_ prefix
        const savedConfigJson = await KeyboardPreferences.getString(configKey);

        if (savedConfigJson) {
          try {
            const savedConfig = JSON.parse(savedConfigJson);
            console.log(`✅ Loaded saved keyboard config from ${configKey}`);
            console.log('📋 Saved config has groups:', !!savedConfig.groups, 'count:', savedConfig.groups?.length || 0);

            // Ensure settings button is enabled for IssieVoice
            savedConfig.settingsButtonEnabled = true;

            // Set the language in config to ensure proper rendering
            savedConfig.language = language;

            // Add language switch key to saved config
            const languageKey = {
              type: 'language',
              label: language === 'en' ? 'עב' : 'En',
              caption: language === 'en' ? 'עב' : 'En',
              value: '',
              width: 1,
              bgColor: '#2196F3',
            };

            // Add clear-all key (trash icon)


            console.log(`🔑 Creating language key for ${language} keyboard:`, languageKey);

            // Determine if we're on mobile (for settings button placement)
            const isMobileDevice = frame.width < 600;

            // Update all keysets to include language switch key and remove close/next-keyboard
            savedConfig.keysets = savedConfig.keysets.map((keyset: any) => ({
              ...keyset,
              rows: keyset.rows.map((row: any, rowIndex: number) => {
                // Check if this is the top row (for mobile settings button)
                const isTopRow = rowIndex === 0;

                // Check if this is the bottom row by looking for space key or if it's the last row with control keys
                const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
                const hasControlKeys = row.keys.some((k: any) =>
                  k.type === 'keyset' || k.type === 'next-keyboard' || k.type === 'close'
                );
                const isBottomRow = row.alwaysInclude || hasSpaceKey || (hasControlKeys && rowIndex === keyset.rows.length - 1);

                // Always filter out unwanted keys
                const filteredKeys = row.keys.filter((key: any) =>
                  key.type !== 'next-keyboard' && key.type !== 'close'
                );

                // MOBILE: Add settings to top row
                if (isMobileDevice && isTopRow) {
                  const hasSettingsKey = row.keys.some((k: any) => k.value === settingsKey.value);

                  if (!hasSettingsKey) {
                    // Add spacer + settings at the end of top row
                    return {
                      ...row,
                      keys: [
                        ...filteredKeys,
                        { hidden: true, width: 0.5 },  // Half-key spacer
                        settingsKey
                      ]
                    };
                  }
                }

                // BOTTOM ROW: Add language switch and clear-all
                if (isBottomRow) {
                  // Check if language key already exists
                  const hasLanguageKey = row.keys.some((k: any) => k.type === 'language');
                  const hasClearAllKey = row.keys.some((k: any) => k.value === clearAllKey.value);
                  const hasSettingsKey = row.keys.some((k: any) => k.value === settingsKey.value);

                  if (!hasLanguageKey || !hasClearAllKey || (!hasSettingsKey && !isMobileDevice)) {
                    // Add language key after first key
                    const newKeys = filteredKeys.reduce((acc: any[], key: any, index: number) => {
                      acc.push(key);
                      if (index === 0 && !hasLanguageKey) {
                        acc.push(languageKey);
                      }
                      return acc;
                    }, []);

                    // Add gap + clear-all (+ settings on non-mobile) at the end
                    if (!hasClearAllKey || (!hasSettingsKey && !isMobileDevice)) {
                      newKeys.push({ hidden: true, width: 0.5 });
                      if (!hasClearAllKey) {
                        newKeys.push(clearAllKey);
                      }
                      // Only add settings to bottom row on non-mobile devices
                      if (!isMobileDevice && !hasSettingsKey) {
                        newKeys.push({ hidden: true, width: 0.5 });
                        newKeys.push(settingsKey);
                      }
                    }

                    return { ...row, keys: newKeys };
                  } else {
                    // Keys exist, just use filtered keys
                    return { ...row, keys: filteredKeys };
                  }
                }
                return row;
              }),
            }));

            // Store the config object for height calculations
            // Use presets instead of absolute values
            console.log('💾 Saved config has:', {
              heightPreset: savedConfig.heightPreset,
              fontSizePreset: savedConfig.fontSizePreset,
              fontWeight: savedConfig.fontWeight,
              hasGroups: !!savedConfig.groups,
              groupCount: savedConfig.groups?.length
            });
            keyboardConfigRef.current = {
              ...savedConfig,
              heightPreset: 'tall',  // Use preset for better accessibility
              fontSizePreset: 'large',  // Use preset for better readability
            };

            console.log('📋 Final config before sending to KeyboardPreview:', {
              hasGroups: !!savedConfig.groups,
              groupCount: savedConfig.groups?.length || 0,
              groups: savedConfig.groups,
              keysetCount: savedConfig.keysets?.length || 0,
            });

            const configString = JSON.stringify(savedConfig);
            console.log('📤 Setting keyboard config from saved profile, length:', configString.length);
            setKeyboardConfig(configString);
            return;
          } catch (parseError) {
            console.warn('⚠️ Failed to parse saved config, falling back to default:', parseError);
          }
        }
      }

      // Fallback: Load default configuration from JSON files
      console.log('📋 No saved config found, loading default keyboard config');

      // Load configuration based on language
      const config = language === 'en'
        ? require('../../../../keyboards/en.json')
        : require('../../../../keyboards/he.json');
      const common = require('../../../../keyboards/common.js');

      console.log('📋 Original config keysets:', config.keysets?.map((k: any) => k.id));
      console.log('📋 Common keysets:', common.keysets?.map((k: any) => k.id));

      // Merge common keysets with language-specific config
      // Filter common keysets to include only those for the current language
      const commonKeysets = common.keysets.map((keyset: any) => ({
        ...keyset,
        rows: keyset.rows.map((row: any) => ({
          ...row,
          keys: row.keys.filter((key: any) => {
            // Include key if it has no forLanguages restriction, or if it includes the current language
            return !key.forLanguages || key.forLanguages.includes(language);
          }),
        })),
      }));

      console.log('📋 Filtered common keysets:', commonKeysets.map((k: any) => k.id));

      // Append "alwaysInclude" rows from the language config to common keysets
      const bottomRow = config.keysets[0].rows.find((row: any) => row.alwaysInclude);
      console.log('📋 Bottom row found:', !!bottomRow);

      if (!bottomRow) {
        console.error('❌ Bottom row not found in keyboard config!');
        return;
      }

      // Create language switch key (blue button)
      const languageKey = {
        type: 'language',
        label: language === 'en' ? 'עב' : 'En',
        caption: language === 'en' ? 'עב' : 'En',
        value: '',  // No text output
        width: 1,
        bgColor: '#2196F3',  // Blue background
      };


      console.log('🔑 Language key:', languageKey);
      console.log('📋 Original bottom row keys:', bottomRow.keys.length);

      // Determine if we're on mobile (for settings button placement)
      const isMobileDevice = frame.width < 600;

      // Remove next-keyboard and close keys, insert language key after the first key (123 button)
      const modifiedBottomRow = {
        ...bottomRow,
        keys: bottomRow.keys
          .filter((key: any) => key.type !== 'next-keyboard' && key.type !== 'close')  // Remove globe and close buttons
          .reduce((acc: any[], key: any, index: number) => {
            acc.push(key);
            // Insert language button after first key (123 button)
            if (index === 0) {
              console.log('🔄 Inserting language key after 123 button');
              acc.push(languageKey);
            }
            return acc;
          }, []),
      };

      // Add gap + clear-all (+ settings on non-mobile) at the end
      modifiedBottomRow.keys.push({ hidden: true, width: 0.5 });
      modifiedBottomRow.keys.push(clearAllKey);
      if (!isMobileDevice) {
        modifiedBottomRow.keys.push({ hidden: true, width: 0.5 });
        modifiedBottomRow.keys.push(settingsKey);
      }

      console.log('📋 Modified bottom row keys:', modifiedBottomRow.keys.length);
      console.log('📋 Modified bottom row keys types:', modifiedBottomRow.keys.map((k: any) => k.type || k.value));

      const mergedCommonKeysets = commonKeysets.map((keyset: any) => ({
        ...keyset,
        rows: [
          // MOBILE: Add settings to top row
          ...(isMobileDevice && keyset.rows.length > 0 ? [{
            ...keyset.rows[0],
            keys: [
              ...keyset.rows[0].keys,
              { hidden: true, width: 0.5 },  // Half-key spacer
              settingsKey
            ]
          }] : [keyset.rows[0]]),
          // Rest of rows
          ...keyset.rows.slice(1),
          // Bottom row
          modifiedBottomRow
        ],
      }));

      // Also modify the original language-specific keysets
      const modifiedLanguageKeysets = config.keysets.map((keyset: any) => ({
        ...keyset,
        rows: keyset.rows.map((row: any, rowIndex: number) => {
          // MOBILE: Add settings to top row
          if (isMobileDevice && rowIndex === 0) {
            return {
              ...row,
              keys: [
                ...row.keys,
                { hidden: true, width: 0.5 },  // Half-key spacer
                settingsKey
              ]
            };
          }

          if (row.alwaysInclude) {
            // This is the bottom row - remove next-keyboard and close, insert language key after first key
            const filteredKeys = row.keys
              .filter((key: any) => key.type !== 'next-keyboard' && key.type !== 'close')
              .reduce((acc: any[], key: any, index: number) => {
                acc.push(key);
                if (index === 0) {
                  acc.push(languageKey);
                }
                return acc;
              }, []);

            // Add gap + clear-all (+ settings on non-mobile) at the end
            filteredKeys.push({ hidden: true, width: 0.5 });
            filteredKeys.push(clearAllKey);
            if (!isMobileDevice) {
              filteredKeys.push({ hidden: true, width: 0.5 });
              filteredKeys.push(settingsKey);
            }

            return {
              ...row,
              keys: filteredKeys,
            };
          }
          return row;
        }),
      }));

      // Combine language-specific keysets with merged common keysets
      const allKeysets = [...modifiedLanguageKeysets, ...mergedCommonKeysets];
      console.log('📋 All keysets:', allKeysets.map((k: any) => k.id));

      // Add IssieVoice-specific settings to the config
      const issieVoiceConfig = {
        ...config,
        keysets: allKeysets,
        heightPreset: 'tall', // Use preset for better accessibility in IssieVoice
        fontSizePreset: 'large', // Use preset for better readability
        language: language, // Set the language for suggestions
        settingsButtonEnabled: true, // Enable settings button
      };

      console.log('📋 Final config keysets:', issieVoiceConfig.keysets.map((k: any) => k.id));

      // Log the bottom row of the first keyset to verify language key is there
      const firstKeyset = issieVoiceConfig.keysets[0];
      const bottomRowCheck = firstKeyset.rows.find((r: any) => r.alwaysInclude);
      if (bottomRowCheck) {
        console.log('🔍 Final bottom row keys:', bottomRowCheck.keys.map((k: any) => ({
          type: k.type,
          label: k.label,
          value: k.value
        })));
      }

      // Store the config object for height calculations
      keyboardConfigRef.current = issieVoiceConfig;

      const configString = JSON.stringify(issieVoiceConfig);
      console.log('📤 Setting keyboard config, length:', configString.length);

      setKeyboardConfig(configString);
    } catch (error) {
      console.error('❌ Failed to load keyboard config:', error);
    }
  };

  // Load settings from storage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedMode = await KeyboardPreferences.getProfile('issievoice_languageMode');
        if (savedMode && (savedMode === 'en-only' || savedMode === 'he-only' || savedMode === 'detect')) {
          setLanguageMode(savedMode as 'en-only' | 'he-only' | 'detect');
        }

        const savedEnVoice = await KeyboardPreferences.getProfile('issievoice_englishVoice');
        if (savedEnVoice) {
          setEnglishVoice(savedEnVoice);
        }

        const savedHeVoice = await KeyboardPreferences.getProfile('issievoice_hebrewVoice');
        if (savedHeVoice) {
          setHebrewVoice(savedHeVoice);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Effect for loading keyboard config when language changes
  useEffect(() => {
    const loadConfig = async () => {
      console.log(`🔄 Language change effect triggered: ${currentLanguage}`);
      // Reset keyboard height to allow fresh measurement
      keyboardHeightRef.current = 350;
      setKeyboardHeight(350);
      await loadKeyboardConfig(currentLanguage);
    };
    loadConfig();
  }, [currentLanguage]);

  // Native keyboard now handles scaling automatically with presets
  // No need for manual height adjustment

  // Separate effect for TTS language to avoid circular dependencies
  useEffect(() => {
    console.log(`🗣️ Updating TTS language: ${currentLanguage}`);
    // Use a timeout to ensure this doesn't cause an infinite loop
    const timer = setTimeout(() => {
      setTTSLanguage(currentLanguage);
    }, 100);

    return () => clearTimeout(timer);
  }, [currentLanguage, setTTSLanguage]);

  // Reload keyboard config when screen comes into focus (e.g., returning from settings)
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 MainScreen focused - reloading keyboard config and favorites');
      const reloadConfig = async () => {
        // Reset keyboard height to allow fresh measurement
        keyboardHeightRef.current = 350;
        setKeyboardHeight(350);
        await loadKeyboardConfig(currentLanguage);
      };
      reloadConfig();
      // Trigger favorites reload
      setFavoritesReloadTrigger(prev => prev + 1);
    }, [currentLanguage])
  );

  // No need for a separate initial load effect as the above effect will run on mount

  const handleKeyPress = (event: KeyPressEvent) => {
    const { type, value, label } = event.nativeEvent;
    console.log('🎹 Key pressed:', { type, value, label, keysetValue: event.nativeEvent.keysetValue, currentLength: currentText.length });

    // Handle event-type keys (custom actions that don't modify text)
    if (type === 'event') {
      console.log('📢 Event key pressed:', value);

      if (value === clearAllKey.value) {
        console.log('🗑️ Clear-all event');
        setText('');
        return;
      }

      if (value === settingsKey.value) {
        console.log('⚙️ Settings event');
        setSettingsModalVisible(true);
        return;
      }

      // Unknown event
      console.warn('⚠️ Unknown event value:', value);
      return;
    }

    // Handle text_changed event from KeyboardEngine (new architecture)
    if (type === 'text_changed') {
      // KeyboardEngine handles all text operations internally
      // Just update React Native state to match
      console.log('📝 Text changed by KeyboardEngine:', value);
      setText(value);
      return;
    }

    // Handle language switch button
    if (type === 'language') {
      console.log('🌐 Language switch button pressed');
      toggleLanguage();
      return;
    }

    // Log keyset button presses more obviously
    if (type === 'keyset') {
      console.log('🔑 KEYSET BUTTON PRESSED:', {
        type,
        value,
        label,
        keysetValue: event.nativeEvent.keysetValue,
        returnKeysetValue: event.nativeEvent.returnKeysetValue,
      });
    }

    // Legacy event handling (for config mode or old implementation)
    // Handle based on type, but if type is empty, check value
    if (type === 'backspace' || value === '\u0008' || value === '⌫') {
      // Backspace
      const shortened = currentText.slice(0, -1);
      console.log('⌫ Backspace, new text:', shortened);
      setText(shortened);
    } else if (type === 'enter' || value === '\n') {
      // Enter/Return
      const withNewline = currentText + '\n';
      console.log('↵ Enter added');
      setText(withNewline);
    } else if (value === ' ') {
      // Space
      const withSpace = currentText + ' ';
      console.log('␣ Space added, new text:', withSpace);
      setText(withSpace);
    } else if (value && value.length > 0) {
      // Any other character (type might be empty, so we check value)
      const newText = currentText + value;
      console.log('📝 Adding character, new text:', newText);
      setText(newText);
    } else {
      console.log('❓ Unhandled key:', { type, value, label });
    }
  };

  const handleSpeak = async () => {
    if (currentText.trim()) {
      await speak(currentText, languageMode, englishVoice, hebrewVoice);
    }
  };

  const handleSave = async () => {
    if (!currentText.trim()) {
      return;
    }

    try {
      const SavedSentencesManager = require('../services/SavedSentencesManager').default;
      const result = await SavedSentencesManager.saveSentence(currentText);

      if (result === null) {
        // Duplicate detected
        console.log('⚠️ Sentence already exists');
        showNotification(strings.alreadyExists || 'This sentence is already saved', 'error');
      } else {
        // Success
        console.log('💾 Sentence saved successfully');
        showNotification(strings.savedSuccessMessage || 'Saved successfully', 'success');
      }
    } catch (error: any) {
      console.error('❌ Save error:', error);
      showNotification(strings.failedToSave || 'Failed to save', 'error');
    }
  };

  const handleBrowse = () => {
    navigation.navigate('Browse');
  };

  const handleSuggestionsChange = (event: any) => {
    const suggestions = event.nativeEvent.suggestions || [];
    console.log('🔮 KB Suggestions received:', suggestions);
    setKbSuggestions(suggestions);
  };

  // Handle suggestion press from the SuggestionsBar
  // This simulates typing to keep the keyboard in sync
  const handleSuggestionFromBar = (suggestion: string) => {
    console.log('💡 Suggestion selected from bar:', suggestion);

    // Check if we're in prediction mode (text ends with whitespace) or completion mode
    const endsWithSpace = /\s$/.test(currentText);

    if (endsWithSpace) {
      // PREDICTION MODE: Text ends with space, just append the predicted word + space
      console.log('📝 Prediction mode: appending word');
      const newText = currentText + suggestion + ' ';
      setText(newText);
    } else {
      // COMPLETION MODE: Replace the partial word with the full word + space
      console.log('📝 Completion mode: replacing partial word');

      // Find the partial word to replace
      const trimmed = currentText.trimEnd();
      let lastSpaceIndex = -1;
      for (let i = trimmed.length - 1; i >= 0; i--) {
        if (/\s/.test(trimmed[i])) {
          lastSpaceIndex = i;
          break;
        }
      }

      // Calculate how many characters to delete (the partial word)
      const partialWordLength = lastSpaceIndex === -1
        ? trimmed.length
        : trimmed.length - lastSpaceIndex - 1;

      // Remove the partial word
      let textAfterDeletion = currentText;
      for (let i = 0; i < partialWordLength; i++) {
        textAfterDeletion = textAfterDeletion.slice(0, -1);
      }

      // Add the full suggestion + space
      const newText = textAfterDeletion + suggestion + ' ';
      setText(newText);
    }
  };

  // Handle favorite press - speak the text
  const handleFavoritePress = async (text: string) => {
    console.log('⭐ Favorite selected:', text);
    await speak(text, languageMode, englishVoice, hebrewVoice);
  };

  // Function to toggle between languages
  const toggleLanguage = () => {
    const newLanguage = currentLanguage === 'en' ? 'he' : 'en';
    console.log(`🌐 Switching language from ${currentLanguage} to ${newLanguage}`);
    setCurrentLanguage(newLanguage);

    // Clear suggestions when language changes to prevent showing suggestions from wrong language
    setKbSuggestions([]);
  };

  // Handle language mode change
  const handleLanguageModeChange = async (mode: 'en-only' | 'he-only' | 'detect') => {
    setLanguageMode(mode);
    try {
      await KeyboardPreferences.setProfile(mode, 'issievoice_languageMode');
      console.log(`💾 Language mode saved: ${mode}`);
    } catch (error) {
      console.error('Failed to save language mode:', error);
    }
  };

  // Handle voice change
  const handleVoiceChange = async (language: 'en' | 'he', voiceId: string) => {
    if (language === 'en') {
      setEnglishVoice(voiceId);
      try {
        await KeyboardPreferences.setProfile(voiceId, 'issievoice_englishVoice');
        console.log(`💾 English voice saved: ${voiceId}`);
      } catch (error) {
        console.error('Failed to save English voice:', error);
      }
    } else {
      setHebrewVoice(voiceId);
      try {
        await KeyboardPreferences.setProfile(voiceId, 'issievoice_hebrewVoice');
        console.log(`💾 Hebrew voice saved: ${voiceId}`);
      } catch (error) {
        console.error('Failed to save Hebrew voice:', error);
      }
    }
  };

  // Handle settings button press from keyboard
  const handleOpenSettings = () => {
    console.log('⚙️ Settings button pressed from keyboard - opening keyboard settings');
    navigation.navigate('KeyboardSettings', { initialLanguage: currentLanguage });
  };

  const isMobile = frame.width < 600;
  const buttonColumnWidth = isMobile ? availableHeight * .175  : availableHeight * .225;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Settings Modal */}
        <SettingsModal
          visible={settingsModalVisible}
          onClose={() => setSettingsModalVisible(false)}
          languageMode={languageMode}
          onLanguageModeChange={handleLanguageModeChange}
          englishVoice={englishVoice}
          hebrewVoice={hebrewVoice}
          onVoiceChange={handleVoiceChange}
        />

        <View>
          <View style={{ flexDirection: "row", width: "100%", height: Math.min(availableHeight * .45, frame.height * 0.25) }}>
            <IVButton
              onPress={handleSpeak}
              width={Math.min(200, frame.width * 0.25)}
              caption={strings.speak}
              icon='🗣️'
              style={{ backgroundColor: "#35C759" }}
            />

            {/* Text Display Area - Center */}
            <View style={{ flex: 1 }}>
              <TextDisplayArea
                text={currentText}
                screenWidth={frame.width}
              />
            </View>

            {/* Save/Load Buttons - Right Side */}
            <View style={{ flexDirection: "column", padding: 4, width: buttonColumnWidth, height: Math.min(availableHeight * .45, frame.height * 0.25) }}>
              <TouchableOpacity
                style={[styles.topButton, { height: Math.min(availableHeight * .225, frame.height * 0.125), backgroundColor: colors.save }]}
                onPress={handleSave}
                activeOpacity={0.7}>
                <Text style={styles.topButtonText}>💾</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.topButton, { height: Math.min(availableHeight * .225, frame.height * 0.125), backgroundColor: colors.browse }]}
                onPress={handleBrowse}
                activeOpacity={0.7}>
                <Text style={styles.topButtonText}>📂</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Suggestions Bar */}
          <SuggestionsBar
            currentText={currentText}
            kbSuggestions={kbSuggestions}
            language={currentLanguage}
            onSuggestionPress={handleSuggestionFromBar}
            height={isLandscape ? availableHeight * 0.15 : availableHeight * 0.1}
            screenWidth={frame.width}
          />


        </View>

        {/* Favorites Bar - Below Suggestions, Above Keyboard */}
        <FavoritesBar
          onFavoritePress={handleFavoritePress}
          height={Math.min(availableHeight * 0.4, isLandscape ? availableHeight * 0.4 : 150)}
          navigation={navigation}
          reloadTrigger={favoritesReloadTrigger}
          screenWidth={frame.width}
        />

        {/* IssieBoard Custom Keyboard - Bottom */}
        <View style={[styles.keyboardContainer, { bottom: 0, height: keyboardHeight }]}>
          <KeyboardPreview
            style={[styles.keyboard, { height: keyboardHeight }]}
            configJson={keyboardConfig}
            language={currentLanguage}
            text={currentText}
            onKeyPress={handleKeyPress}
            onSuggestionsChange={handleSuggestionsChange}
            onOpenSettings={handleOpenSettings}
            onHeightChange={(e) => {
              const newHeight = e.nativeEvent.height - 40;
              console.log('⌨️ Keyboard reported height:', e.nativeEvent.height, '→ setting container to:', newHeight);
              // Update both ref and state
              keyboardHeightRef.current = newHeight;
              setKeyboardHeight(newHeight);
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  topButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: sizes.borderRadius.small,
    margin: 2,
  },
  topButtonText: {
    fontSize: 32,
  },
  scrollableContent: {
    // Remove flex, use fixed height instead
  },
  keyboardContainer: {
    position: "absolute", width: "100%",
    backgroundColor: colors.surface,
  },
  keyboard: {
    flex: 1,
  },
  actionsContainer: {
    width: '100%',
  },
});

export default MainScreen;