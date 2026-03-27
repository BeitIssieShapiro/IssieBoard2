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
import { buildKeyboardConfig } from '../../../../src/utils/keyboardConfigMerger';
import { colors, sizes } from '../constants';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';
import { symbolService } from '../services/SymbolService';
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
  const { currentText, setText, cursorPosition, setCursorPosition } = useText();
  const { speak, setLanguage: setTTSLanguage } = useTTS();
  const { language: deviceLanguage, strings } = useLocalization();
  const { showNotification } = useNotification();
  const [keyboardConfig, setKeyboardConfig] = useState<string>('');
  const [keyboardBgColor, setKeyboardBgColor] = useState<string>('#D1D1D1');
  const [kbSuggestions, setKbSuggestions] = useState<string[]>([]);
  const [symbolUrls, setSymbolUrls] = useState<Map<string, string | null>>(new Map());
  const symbolDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(350);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'he'>(deviceLanguage === 'ar' ? 'he' : deviceLanguage);
  const [languageMode, setLanguageMode] = useState<'en-only' | 'he-only' | 'detect'>('detect');
  const [englishVoice, setEnglishVoice] = useState<string | undefined>(undefined);
  const [hebrewVoice, setHebrewVoice] = useState<string | undefined>(undefined);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [favoritesReloadTrigger, setFavoritesReloadTrigger] = useState(0);
  const keyboardConfigRef = useRef<any>(null);
  const keyboardHeightRef = useRef<number>(350);

  // Load symbol cache and clean up debounce on unmount
  useEffect(() => {
    symbolService.loadCache();
    return () => {
      // Clean up debounce timeout on unmount
      if (symbolDebounceRef.current) {
        clearTimeout(symbolDebounceRef.current);
      }
    };
  }, []);

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
                      newKeys.push({ hidden: true, width: 0.25 });
                      if (!hasClearAllKey) {
                        newKeys.push(clearAllKey);
                      }
                      // Only add settings to bottom row on non-mobile devices
                      if (!isMobileDevice && !hasSettingsKey) {
                        newKeys.push({ hidden: true, width: 0.1 });
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
            const bg = savedConfig.backgroundColor;
            setKeyboardBgColor(!bg || bg === 'default' ? '#D1D1D1' : bg);
            setKeyboardConfig(configString);
            return;
          } catch (parseError) {
            console.warn('⚠️ Failed to parse saved config, falling back to default:', parseError);
          }
        }
      }

      // Fallback: Load default configuration using the shared merger (same as IssieBoard)
      console.log('📋 No saved config found, loading default keyboard config');

      // Load source keyboard based on language
      const sourceKeyboard = language === 'en'
        ? require('../../../../keyboards/en.json')
        : require('../../../../keyboards/he.json');

      // Build config using the same merger IssieBoard uses
      const baseConfig = buildKeyboardConfig(sourceKeyboard, language);

      // Create IssieVoice-specific keys
      const languageKey = {
        type: 'language',
        label: language === 'en' ? 'עב' : 'En',
        caption: language === 'en' ? 'עב' : 'En',
        value: '',
        width: 1,
        bgColor: '#2196F3',
      };

      const isMobileDevice = frame.width < 600;

      // Inject IssieVoice keys (language switch, clear-all, settings) into each keyset
      const modifiedKeysets = baseConfig.keysets.map((keyset: any) => ({
        ...keyset,
        rows: keyset.rows.map((row: any, rowIndex: number) => {
          const isTopRow = rowIndex === 0;
          const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
          const hasControlKeys = row.keys.some((k: any) =>
            k.type === 'keyset' || k.type === 'next-keyboard' || k.type === 'close'
          );
          const isBottomRow = row.alwaysInclude || hasSpaceKey || (hasControlKeys && rowIndex === keyset.rows.length - 1);

          // Filter out unwanted keys
          const filteredKeys = row.keys.filter((key: any) =>
            key.type !== 'next-keyboard' && key.type !== 'close'
          );

          // MOBILE: Add settings to top row
          if (isMobileDevice && isTopRow) {
            const hasSettingsKey = row.keys.some((k: any) => k.value === settingsKey.value);
            if (!hasSettingsKey) {
              return {
                ...row,
                keys: [
                  ...filteredKeys,
                  { hidden: true, width: 0.5 },
                  settingsKey
                ]
              };
            }
          }

          // BOTTOM ROW: Add language switch and clear-all
          if (isBottomRow) {
            const hasLanguageKey = row.keys.some((k: any) => k.type === 'language');
            const hasClearAllKey = row.keys.some((k: any) => k.value === clearAllKey.value);
            const hasSettingsKey = row.keys.some((k: any) => k.value === settingsKey.value);

            if (!hasLanguageKey || !hasClearAllKey || (!hasSettingsKey && !isMobileDevice)) {
              const newKeys = filteredKeys.reduce((acc: any[], key: any, index: number) => {
                acc.push(key);
                if (index === 0 && !hasLanguageKey) {
                  acc.push(languageKey);
                }
                return acc;
              }, []);

              if (!hasClearAllKey || (!hasSettingsKey && !isMobileDevice)) {
                newKeys.push({ hidden: true, width: 0.25 });
                if (!hasClearAllKey) {
                  newKeys.push(clearAllKey);
                }
                if (!isMobileDevice && !hasSettingsKey) {
                  newKeys.push({ hidden: true, width: 0.1 });
                  newKeys.push(settingsKey);
                }
              }

              return { ...row, keys: newKeys };
            } else {
              return { ...row, keys: filteredKeys };
            }
          }
          return { ...row, keys: filteredKeys };
        }),
      }));

      const issieVoiceConfig = {
        ...baseConfig,
        keysets: modifiedKeysets,
        heightPreset: 'tall',
        fontSizePreset: 'large',
        language: language,
        settingsButtonEnabled: true,
      };

      console.log('📋 Final config keysets:', issieVoiceConfig.keysets.map((k: any) => k.id));

      // Store the config object for height calculations
      keyboardConfigRef.current = issieVoiceConfig;

      const configString = JSON.stringify(issieVoiceConfig);
      console.log('📤 Setting keyboard config, length:', configString.length);

      const bg = issieVoiceConfig.backgroundColor;
      setKeyboardBgColor(!bg || bg === 'default' ? '#D1D1D1' : bg);
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
      loadKeyboardConfig(currentLanguage);
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
      // The native engine manages its own text buffer (always appends at end).
      // Compute the delta and apply it at the cursor position instead.
      const engineText = value;
      const pos = cursorPosition;
      const before = currentText.slice(0, pos);
      const after = currentText.slice(pos);

      if (engineText.length > currentText.length) {
        // Character(s) added — find what was inserted
        // The engine appends at end, so the new chars are at the tail
        const inserted = engineText.slice(currentText.length);
        const newText = before + inserted + after;
        setCursorPosition(pos + inserted.length);
        setText(newText);
      } else if (engineText.length < currentText.length) {
        // Character(s) deleted (backspace)
        const deletedCount = currentText.length - engineText.length;
        const deleteFrom = Math.max(0, pos - deletedCount);
        const newText = currentText.slice(0, deleteFrom) + after;
        setCursorPosition(deleteFrom);
        setText(newText);
      } else {
        // Same length — could be a replacement, just use engine text
        setText(engineText);
      }
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
    // Insert at cursor position
    const pos = cursorPosition;
    const before = currentText.slice(0, pos);
    const after = currentText.slice(pos);

    if (type === 'backspace' || value === '\u0008' || value === '⌫') {
      if (pos > 0) {
        const newText = currentText.slice(0, pos - 1) + after;
        setCursorPosition(pos - 1);
        setText(newText);
      }
    } else if (type === 'enter' || value === '\n') {
      setText(before + '\n' + after);
      setCursorPosition(pos + 1);
    } else if (value === ' ') {
      setText(before + ' ' + after);
      setCursorPosition(pos + 1);
    } else if (value && value.length > 0) {
      setText(before + value + after);
      setCursorPosition(pos + value.length);
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
        showNotification(strings.notifications.alreadyExists, 'error');
      } else {
        // Success
        console.log('💾 Sentence saved successfully');
        showNotification(strings.notifications.savedSuccess, 'success');
      }
    } catch (error: any) {
      console.error('❌ Save error:', error);
      showNotification(strings.notifications.failedToSave, 'error');
    }
  };

  const handleBrowse = () => {
    navigation.navigate('Browse');
  };

  const handleSuggestionsChange = (event: any) => {
    const suggestions = event.nativeEvent.suggestions || [];
    console.log('🔮 KB Suggestions received:', suggestions);
    setKbSuggestions(suggestions);
    suggestionsRef.current = suggestions;

    // Debounce symbol lookups
    if (symbolDebounceRef.current) {
      clearTimeout(symbolDebounceRef.current);
    }
    symbolDebounceRef.current = setTimeout(async () => {
      if (suggestions.length === 0) {
        setSymbolUrls(new Map());
        return;
      }
      const urls = await symbolService.getSymbolUrls(suggestions);
      // Only update if suggestions haven't changed
      if (suggestionsRef.current === suggestions) {
        setSymbolUrls(urls);
      }
    }, 300);
  };

  // Handle suggestion press from the SuggestionsBar
  const handleSuggestionFromBar = (suggestion: string) => {
    const pos = cursorPosition;

    // Find the word boundaries around the cursor
    let wordStart = pos;
    while (wordStart > 0 && !/\s/.test(currentText[wordStart - 1])) {
      wordStart--;
    }
    let wordEnd = pos;
    while (wordEnd < currentText.length && !/\s/.test(currentText[wordEnd])) {
      wordEnd++;
    }

    // Replace the entire word at cursor with suggestion + space
    const before = currentText.slice(0, wordStart);
    const after = currentText.slice(wordEnd);
    const newText = before + suggestion + ' ' + after;
    const newCursor = wordStart + suggestion.length + 1;
    setCursorPosition(newCursor);
    setText(newText);
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
  const suggestionsHeight = isLandscape ? availableHeight * 0.22 : availableHeight * 0.18;
  const minSymbolHeight = availableHeight * 0.4 >= 120 ? 120 : suggestionsHeight;

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
              caption={strings.actionBar.speak}
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
        </View>

        {/* Favorites Bar - Below top section, Above Keyboard */}
        <FavoritesBar
          onFavoritePress={handleFavoritePress}
          height={Math.min(availableHeight * 0.4, isLandscape ? availableHeight * 0.4 : 150)}
          navigation={navigation}
          reloadTrigger={favoritesReloadTrigger}
          screenWidth={frame.width}
        />

        {/* Unified Keyboard + Suggestions Container */}
        <View style={[styles.keyboardWrapper, { backgroundColor: keyboardBgColor }]}>
          {/* Suggestions Bar - seamlessly integrated */}
          <SuggestionsBar
            currentText={currentText}
            kbSuggestions={kbSuggestions}
            symbolUrls={symbolUrls}
            language={currentLanguage}
            onSuggestionPress={handleSuggestionFromBar}
            height={Math.max(minSymbolHeight, suggestionsHeight)}
            screenWidth={frame.width}
          />

          {/* IssieBoard Custom Keyboard */}
          <View style={{ height: keyboardHeight }}>
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
                keyboardHeightRef.current = newHeight;
                setKeyboardHeight(newHeight);
              }}
            />
          </View>
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
    zIndex: 10
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
  keyboardWrapper: {
    borderRadius: 12,
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    padding: 8,
    boxShadow: '4px 4px 20px rgba(0, 0, 0, 0.4)',
  },
  keyboard: {
    flex: 1,
  },
});

export default MainScreen;