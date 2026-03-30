import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
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

import { KeyboardPreview, KeyPressEvent } from '../../../../src/components/KeyboardPreview';
import { buildKeyboardConfig } from '../../../../src/utils/keyboardConfigMerger';
import { colors } from '../constants';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';
import { symbolService } from '../services/SymbolService';

interface MainScreenProps {
  navigation: any;
}

const MainScreen: React.FC<MainScreenProps> = ({ navigation }) => {
  const { currentText, setText, cursorPosition, setCursorPosition } = useText();
  const { speak, setLanguage: setTTSLanguage } = useTTS();
  const { language: deviceLanguage, strings } = useLocalization();
  const { showNotification } = useNotification();
  const [keyboardConfig, setKeyboardConfig] = useState<string>('');
  const defaultKbBg = Platform.OS === 'android' ? '#D2D3D9' : '#CBCFD8';
  const [keyboardBgColor, setKeyboardBgColor] = useState<string>(defaultKbBg);
  const [kbSuggestions, setKbSuggestions] = useState<string[]>([]);
  const [symbolUrls, setSymbolUrls] = useState<Map<string, string | null>>(new Map());
  const symbolDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(350);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'he'>(deviceLanguage === 'ar' ? 'he' : deviceLanguage);
  const [englishVoice, setEnglishVoice] = useState<string | undefined>(undefined);
  const [hebrewVoice, setHebrewVoice] = useState<string | undefined>(undefined);
  const [favoritesReloadTrigger, setFavoritesReloadTrigger] = useState(0);
  const keyboardConfigRef = useRef<any>(null);
  const keyboardHeightRef = useRef<number>(350);
  const [speakButtonInKeyboard, setSpeakButtonInKeyboard] = useState(false);
  const [symbolsInSuggestions, setSymbolsInSuggestions] = useState(false);

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
  const isPhoneLandscape = isLandscape && Math.min(frame.width, frame.height) < 600;
  const isRTL = currentLanguage === 'he';

  // Inject speak key into the abc keyset's bottom row, replacing the rightmost keyset key
  const injectSpeakKey = (keysets: any[], speakLabel: string) => {
    return keysets.map((keyset: any) => {
      // Only modify the abc keyset (main alphabetic view)
      if (keyset.id !== 'abc' && keyset.id !== 'abc_large') return keyset;

      const rows = keyset.rows.map((row: any) => {
        const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
        const hasControlKeys = row.keys.some((k: any) =>
          k.type === 'keyset' || k.type === 'next-keyboard' || k.type === 'close'
        );
        const isBottomRow = row.alwaysInclude || hasSpaceKey || hasControlKeys;
        if (!isBottomRow) return row;

        // Find the rightmost keyset key and replace it with the speak key
        const lastKeysetIndex = row.keys.reduce((lastIdx: number, key: any, idx: number) =>
          key.type === 'keyset' ? idx : lastIdx, -1);

        if (lastKeysetIndex === -1) return row;

        const newKeys = [...row.keys];
        newKeys[lastKeysetIndex] = {
          type: 'event',
          value: 'speak',
          label: `🔊 ${speakLabel}`,
          caption: `🔊 ${speakLabel}`,
          width: 2,
          bgColor: '#2196F3',
          textColor: '#FFFFFF',
        };
        return { ...row, keys: newKeys };
      });
      return { ...keyset, rows };
    });
  };

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

            console.log(`🔑 Creating language key for ${language} keyboard:`, languageKey);

            // Update all keysets to include language switch key and remove close/next-keyboard
            savedConfig.keysets = savedConfig.keysets.map((keyset: any) => ({
              ...keyset,
              rows: keyset.rows.map((row: any) => {
                const filteredKeys = row.keys.filter((key: any) =>
                  key.type !== 'next-keyboard' && key.type !== 'close' && key.type !== 'settings'
                );

                const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
                const hasControlKeys = row.keys.some((k: any) =>
                  k.type === 'keyset' || k.type === 'next-keyboard' || k.type === 'close' || k.type === 'settings'
                );
                const isBottomRow = row.alwaysInclude || hasSpaceKey || hasControlKeys;

                if (isBottomRow) {
                  const hasLanguageKey = row.keys.some((k: any) => k.type === 'language');
                  if (!hasLanguageKey) {
                    const newKeys = filteredKeys.reduce((acc: any[], key: any, index: number) => {
                      acc.push(key);
                      if (index === 0) {
                        acc.push(languageKey);
                      }
                      return acc;
                    }, []);
                    return { ...row, keys: newKeys };
                  }
                  return { ...row, keys: filteredKeys };
                }
                return { ...row, keys: filteredKeys };
              }),
            }));

            // Inject speak key if setting is enabled
            if (speakButtonInKeyboard) {
              savedConfig.keysets = injectSpeakKey(savedConfig.keysets, strings.actionBar.speak.trim());
            }

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
            setKeyboardBgColor(!bg || bg === 'default' ? defaultKbBg : bg);
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

      // Inject IssieVoice keys (language switch) into each keyset
      const modifiedKeysets = baseConfig.keysets.map((keyset: any) => ({
        ...keyset,
        rows: keyset.rows.map((row: any) => {
          const filteredKeys = row.keys.filter((key: any) =>
            key.type !== 'next-keyboard' && key.type !== 'close' && key.type !== 'settings'
          );

          const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
          const hasControlKeys = row.keys.some((k: any) =>
            k.type === 'keyset' || k.type === 'next-keyboard' || k.type === 'close' || k.type === 'settings'
          );
          const isBottomRow = row.alwaysInclude || hasSpaceKey || hasControlKeys;

          if (isBottomRow) {
            const hasLanguageKey = row.keys.some((k: any) => k.type === 'language');
            if (!hasLanguageKey) {
              const newKeys = filteredKeys.reduce((acc: any[], key: any, index: number) => {
                acc.push(key);
                if (index === 0) {
                  acc.push(languageKey);
                }
                return acc;
              }, []);
              return { ...row, keys: newKeys };
            }
            return { ...row, keys: filteredKeys };
          }
          return { ...row, keys: filteredKeys };
        }),
      }));

      const issieVoiceConfig = {
        ...baseConfig,
        keysets: speakButtonInKeyboard
          ? injectSpeakKey(modifiedKeysets, strings.actionBar.speak.trim())
          : modifiedKeysets,
        heightPreset: 'tall',
        fontSizePreset: 'large',
        language: language,
      };

      console.log('📋 Final config keysets:', issieVoiceConfig.keysets.map((k: any) => k.id));

      // Store the config object for height calculations
      keyboardConfigRef.current = issieVoiceConfig;

      const configString = JSON.stringify(issieVoiceConfig);
      console.log('📤 Setting keyboard config, length:', configString.length);

      const bg = issieVoiceConfig.backgroundColor;
      setKeyboardBgColor(!bg || bg === 'default' ? defaultKbBg : bg);
      setKeyboardConfig(configString);
    } catch (error) {
      console.error('❌ Failed to load keyboard config:', error);
    }
  };

  // Load voice settings from storage on mount and when returning from settings
  useFocusEffect(
    React.useCallback(() => {
      const loadSettings = async () => {
        try {
          const savedEnVoice = await KeyboardPreferences.getProfile('issievoice_englishVoice');
          if (savedEnVoice) {
            setEnglishVoice(savedEnVoice);
          }

          const savedHeVoice = await KeyboardPreferences.getProfile('issievoice_hebrewVoice');
          if (savedHeVoice) {
            setHebrewVoice(savedHeVoice);
          }

          const speakInKb = await KeyboardPreferences.getString('issievoice_speakButtonInKeyboard');
          setSpeakButtonInKeyboard(speakInKb === 'true');

          const symbolsVal = await KeyboardPreferences.getString('issievoice_symbolsInSuggestions');
          setSymbolsInSuggestions(symbolsVal === 'true');
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
      };
      loadSettings();
    }, [])
  );

  // Effect for loading keyboard config when language or speak-in-keyboard setting changes
  useEffect(() => {
    const loadConfig = async () => {
      console.log(`🔄 Language change effect triggered: ${currentLanguage}, speakInKb: ${speakButtonInKeyboard}`);
      // Reset keyboard height to allow fresh measurement
      keyboardHeightRef.current = 350;
      setKeyboardHeight(350);
      await loadKeyboardConfig(currentLanguage);
    };
    loadConfig();
  }, [currentLanguage, speakButtonInKeyboard]);

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
      if (value === 'speak') {
        handleSpeak();
        return;
      }
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
      await speak(currentText, 'detect', englishVoice, hebrewVoice);
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
      if (!symbolsInSuggestions || suggestions.length === 0) {
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
    await speak(text, 'detect', englishVoice, hebrewVoice);
  };

  // Function to toggle between languages
  const toggleLanguage = () => {
    const newLanguage = currentLanguage === 'en' ? 'he' : 'en';
    console.log(`🌐 Switching language from ${currentLanguage} to ${newLanguage}`);
    setCurrentLanguage(newLanguage);

    // Clear suggestions when language changes to prevent showing suggestions from wrong language
    setKbSuggestions([]);
  };



  const suggestionsHeight = isLandscape ? availableHeight * 0.22 : availableHeight * 0.18;
  const minSymbolHeight = availableHeight * 0.4 >= 120 ? 120 : suggestionsHeight;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header Bar */}
        <View style={[styles.headerBar, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.navigate('Settings', { initialLanguage: currentLanguage })}
            activeOpacity={0.7}>
            <Text style={styles.menuButtonText}>☰</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isRTL && { marginLeft: 0, marginRight: 12 }]}>Issie Voice</Text>
        </View>

        {/* Text Area Row */}
        <View style={[styles.textAreaRow, {
          maxHeight: Math.min(availableHeight * 0.3, frame.height * 0.18),
        }, isRTL && { flexDirection: 'row-reverse' }]}>
          {/* Text Area with Floating Speak Button */}
          <View style={styles.textAreaContainer}>
            <View style={{ flex: 1 }}>
              <TextDisplayArea
                text={currentText}
                screenWidth={frame.width}
                speakButtonPadding={speakButtonInKeyboard ? 0 : 50}
                onSave={handleSave}
              />
            </View>

            {/* Floating Speak Button - hidden when speak is in keyboard */}
            {!speakButtonInKeyboard && (
            <View style={[styles.speakFabWrapper, isRTL && { right: undefined, left: 14 }]} pointerEvents="box-none">
              <TouchableOpacity
                style={[styles.speakFab, isRTL && { flexDirection: 'row-reverse' }]}
                onPress={handleSpeak}
                activeOpacity={0.7}>
                <MyIcon info={{ name: 'record-voice-over', type: 'MI', color: '#FFFFFF', size: 20 }} />
                <Text style={styles.speakFabLabel}>{strings.actionBar.speak}</Text>
              </TouchableOpacity>
            </View>
            )}
          </View>
        </View>

        {/* Favorites Bar - Below top section, Above Keyboard (hidden on phone landscape) */}
        {!isPhoneLandscape && (
          <FavoritesBar
            onFavoritePress={handleFavoritePress}
            height={Math.min(availableHeight * 0.4, isLandscape ? availableHeight * 0.4 : 250)}
            navigation={navigation}
            reloadTrigger={favoritesReloadTrigger}
            screenWidth={frame.width}
            isRTL={isRTL}
          />
        )}

        {/* Unified Keyboard + Suggestions Container */}
        <View style={[styles.keyboardWrapper, { backgroundColor: keyboardBgColor }]}>
          {/* Suggestions Bar - seamlessly integrated */}
          <SuggestionsBar
            currentText={currentText}
            kbSuggestions={kbSuggestions}
            symbolUrls={symbolsInSuggestions ? symbolUrls : new Map()}
            language={currentLanguage}
            onSuggestionPress={handleSuggestionFromBar}
            onBrowse={handleBrowse}
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
              hideGlobeButton
              onKeyPress={handleKeyPress}
              onSuggestionsChange={handleSuggestionsChange}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginLeft: 12,
  },
  textAreaRow: {
    flex: 1,
    flexDirection: 'row',
    paddingLeft: 16,
    paddingRight: 16,
    marginTop: 10,
    gap: 12,
  },
  textAreaContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
  },
  speakFabWrapper: {
    position: 'absolute',
    bottom: 8,
    right: 14,
    justifyContent: 'flex-end',
  },
  speakFab: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginVertical: 5,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  speakFabIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  speakFabLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  keyboardWrapper: {
    borderRadius: 12,
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    padding: 8,
    marginHorizontal: 8,
    boxShadow: '4px 4px 20px rgba(0, 0, 0, 0.4)',
    zIndex: 20,
    elevation: 20,
  },
  keyboard: {
    flex: 1,
  },
});

export default MainScreen;