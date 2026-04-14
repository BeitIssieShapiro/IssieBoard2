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
import FavoritesBar from '../components/FavoritesBar/FavoritesBar';

import { KeyboardPreview, KeyPressEvent } from '../../../../src/components/KeyboardPreview';
import { buildKeyboardConfig } from '../../../../src/utils/keyboardConfigMerger';
import { colors } from '../constants';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';
import { LANGUAGE_CYCLE_ORDER, KbLanguage } from '../components/Settings/LanguageSettingsPanel';

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
  const [keyboardHeight, setKeyboardHeight] = useState(350);
  const [selectedLanguages, setSelectedLanguages] = useState<KbLanguage[]>(['he', 'en']);
  const [currentLanguage, setCurrentLanguage] = useState<KbLanguage>('he');
  const [languagesLoaded, setLanguagesLoaded] = useState(false);
  const [englishVoice, setEnglishVoice] = useState<string | undefined>(undefined);
  const [hebrewVoice, setHebrewVoice] = useState<string | undefined>(undefined);
  const [arabicVoice, setArabicVoice] = useState<string | undefined>(undefined);
  const [favoritesReloadTrigger, setFavoritesReloadTrigger] = useState(0);
  const keyboardConfigRef = useRef<any>(null);
  const keyboardHeightRef = useRef<number>(350);
  const [speakButtonInKeyboard, setSpeakButtonInKeyboard] = useState(false);
  const [symbolsInSuggestions, setSymbolsInSuggestions] = useState(false);
  const [favoritesUnusedHeight, setFavoritesUnusedHeight] = useState(0);

  // Load selected languages and last language from preferences
  useEffect(() => {
    const loadLanguagePrefs = async () => {
      let langs: KbLanguage[] = ['he', 'en'];
      try {
        const savedLangs = await KeyboardPreferences.getString('issievoice_selectedLanguages');
        if (savedLangs) {
          const parsed = JSON.parse(savedLangs) as KbLanguage[];
          if (parsed.length > 0) langs = parsed;
        }
      } catch {}

      setSelectedLanguages(langs);

      // Determine initial language
      let initial: KbLanguage = langs[0];
      try {
        const lastLang = await KeyboardPreferences.getString('issievoice_lastLanguage');
        if (lastLang && langs.includes(lastLang as KbLanguage)) {
          initial = lastLang as KbLanguage;
        } else if (langs.includes(deviceLanguage as KbLanguage)) {
          initial = deviceLanguage as KbLanguage;
        }
      } catch {}

      setCurrentLanguage(initial);
      setLanguagesLoaded(true);
    };
    loadLanguagePrefs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get window dimensions using useSafeAreaFrame (works with ScreenSizer)
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();

  const availableHeight = frame.height - insets.top - insets.bottom - keyboardHeight;

  // Determine if landscape or portrait
  const isLandscape = frame.width > frame.height;
  const isPhoneLandscape = isLandscape && Math.min(frame.width, frame.height) < 600;
  const isRTL = deviceLanguage === 'he' || deviceLanguage === 'ar';

  // Inject speak key into the abc keyset's bottom row
  const injectSpeakKey = (keysets: any[], speakLabel: string, groups?: any[]) => {
    // Only use default colors if no style group targets the speak key
    const hasSpeakGroup = groups?.some((g: any) => g.items?.includes('speak'));
    const speakKey = {
      type: 'event',
      value: 'speak',
      label: `🔊 ${speakLabel}`,
      caption: `🔊 ${speakLabel}`,
      width: 2,
      ...(hasSpeakGroup ? {} : { bgColor: colors.primary, textColor: '#FFFFFF' }),
    };

    return keysets.map((keyset: any) => {
      const rows = keyset.rows.map((row: any) => {
        const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
        const isBottomRow = row.alwaysInclude || hasSpaceKey;
        if (!isBottomRow) return row;

        // Replace the enter key with speak, or append speak at the end if no enter
        const newKeys = [...row.keys];
        const enterIndex = newKeys.findIndex((k: any) => k.type === 'enter');
        if (enterIndex >= 0) {
          newKeys[enterIndex] = speakKey;
        } else {
          newKeys.push(speakKey);
        }
        return { ...row, keys: newKeys };
      });
      return { ...keyset, rows };
    });
  };

  // Compute the label for the language key (shows the NEXT language in cycle)
  const getLanguageKeyLabel = (language: string): string => {
    const activeLangs = LANGUAGE_CYCLE_ORDER.filter(l => selectedLanguages.includes(l));
    if (activeLangs.length <= 1) return '';
    const currentIndex = activeLangs.indexOf(language as KbLanguage);
    const nextIndex = (currentIndex + 1) % activeLangs.length;
    const nextLang = activeLangs[nextIndex];
    switch (nextLang) {
      case 'he': return 'עב';
      case 'en': return 'En';
      case 'ar': return 'عر';
    }
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
            const langLabel = getLanguageKeyLabel(language);
            const showLanguageKey = langLabel !== '';
            // Only use default bgColor if no style group targets the language key
            const hasLangGroup = savedConfig.groups?.some((g: any) => g.items?.includes('language'));
            const languageKey = showLanguageKey ? {
              type: 'language',
              label: langLabel,
              caption: langLabel,
              value: '',
              width: 1,
              ...(hasLangGroup ? {} : { bgColor: colors.primary }),
            } : null;

            console.log(`🔑 Creating language key for ${language} keyboard:`, languageKey);

            // Update all keysets to include language switch key and remove close/next-keyboard
            savedConfig.keysets = savedConfig.keysets.map((keyset: any) => ({
              ...keyset,
              rows: keyset.rows.map((row: any) => {
                const filteredKeys = row.keys.filter((key: any) =>
                  key.type !== 'next-keyboard' && key.type !== 'close' && key.type !== 'settings'
                );

                const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
                const isBottomRow = row.alwaysInclude || hasSpaceKey;

                if (isBottomRow && showLanguageKey) {
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
                  // Update existing language key label
                  return { ...row, keys: filteredKeys.map((k: any) =>
                    k.type === 'language' ? { ...k, label: langLabel, caption: langLabel } : k
                  )};
                }
                return { ...row, keys: filteredKeys };
              }),
            }));

            // Inject speak key if setting is enabled
            if (speakButtonInKeyboard) {
              savedConfig.keysets = injectSpeakKey(savedConfig.keysets, strings.actionBar.speak.trim(), savedConfig.groups);
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
      let sourceKeyboard;
      if (language === 'en') {
        sourceKeyboard = require('../../../../keyboards/en.json');
      } else if (language === 'ar') {
        sourceKeyboard = require('../../../../keyboards/ar.json');
      } else {
        sourceKeyboard = require('../../../../keyboards/he.json');
      }

      // Build config using the same merger IssieBoard uses
      const baseConfig = buildKeyboardConfig(sourceKeyboard, language);

      // Create IssieVoice-specific keys
      const langLabel = getLanguageKeyLabel(language);
      const showLanguageKey = langLabel !== '';
      const languageKey = showLanguageKey ? {
        type: 'language',
        label: langLabel,
        caption: langLabel,
        value: '',
        width: 1,
        bgColor: colors.primary,
      } : null;

      // Inject IssieVoice keys (language switch) into each keyset
      const modifiedKeysets = baseConfig.keysets.map((keyset: any) => ({
        ...keyset,
        rows: keyset.rows.map((row: any) => {
          const filteredKeys = row.keys.filter((key: any) =>
            key.type !== 'next-keyboard' && key.type !== 'close' && key.type !== 'settings'
          );

          const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
          const isBottomRow = row.alwaysInclude || hasSpaceKey;

          if (isBottomRow && showLanguageKey) {
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
            return { ...row, keys: filteredKeys.map((k: any) =>
              k.type === 'language' ? { ...k, label: langLabel, caption: langLabel } : k
            )};
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

          const savedArVoice = await KeyboardPreferences.getProfile('issievoice_arabicVoice');
          if (savedArVoice) {
            setArabicVoice(savedArVoice);
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
    if (!languagesLoaded) return;
    const loadConfig = async () => {
      console.log(`🔄 Language change effect triggered: ${currentLanguage}, speakInKb: ${speakButtonInKeyboard}`);
      // Reset keyboard height to allow fresh measurement
      keyboardHeightRef.current = 350;
      setKeyboardHeight(350);
      await loadKeyboardConfig(currentLanguage);
    };
    loadConfig();
  }, [currentLanguage, speakButtonInKeyboard, languagesLoaded, selectedLanguages]);

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

  // Persist last language
  useEffect(() => {
    if (languagesLoaded) {
      KeyboardPreferences.setString('issievoice_lastLanguage', currentLanguage);
    }
  }, [currentLanguage, languagesLoaded]);

  // Reload keyboard config when screen comes into focus (e.g., returning from settings)
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 MainScreen focused - reloading keyboard config and favorites');
      const reloadPrefs = async () => {
        try {
          const savedLangs = await KeyboardPreferences.getString('issievoice_selectedLanguages');
          if (savedLangs) {
            const parsed = JSON.parse(savedLangs) as KbLanguage[];
            if (parsed.length > 0) {
              setSelectedLanguages(parsed);
              // If current language was deselected, switch to first selected language
              if (!parsed.includes(currentLanguage)) {
                setCurrentLanguage(parsed[0]);
                return; // currentLanguage change will trigger config reload
              }
            }
          }
        } catch {}
      };
      reloadPrefs();
      loadKeyboardConfig(currentLanguage);
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
      // The native engine manages its own text buffer (always appends/deletes at end).
      // Native sends prevLength (buffer length before) and deletedTo (min length reached)
      // to compute exact deltas even for compound ops (e.g. "i"→"I" auto-capitalize).
      const engineText = value;
      const prevLength: number | undefined = event.nativeEvent.prevLength;
      const deletedTo: number | undefined = event.nativeEvent.deletedTo;
      const pos = cursorPosition;
      const after = currentText.slice(pos);

      if (prevLength != null && deletedTo != null) {
        // Use precise delta from native
        const deleted = prevLength - deletedTo;
        const inserted = engineText.slice(deletedTo);
        const deleteFrom = Math.max(0, pos - deleted);
        const newBefore = currentText.slice(0, deleteFrom);
        const newText = newBefore + inserted + after;
        const newCursor = deleteFrom + inserted.length;
        setCursorPosition(newCursor);
        setText(newText);
      } else {
        // Fallback: compare lengths against currentText
        if (engineText.length > currentText.length) {
          const inserted = engineText.slice(currentText.length);
          const newText = currentText.slice(0, pos) + inserted + after;
          setCursorPosition(pos + inserted.length);
          setText(newText);
        } else if (engineText.length < currentText.length) {
          const deletedCount = currentText.length - engineText.length;
          const deleteFrom = Math.max(0, pos - deletedCount);
          const newText = currentText.slice(0, deleteFrom) + after;
          setCursorPosition(deleteFrom);
          setText(newText);
        } else {
          setText(engineText);
        }
      }
      return;
    }

    // Handle cursor movement from swipe gesture on space key
    // The native renderer already inverts the offset for RTL (for the system keyboard's
    // adjustTextPosition API which works in reading order). But in IssieVoice, cursorPosition
    // is a string index where higher = further in text, and the TextInput handles RTL display.
    // So we need to undo the RTL inversion — the raw swipe direction maps directly to index change.
    if (type === 'cursor_move') {
      const offset = parseInt(value, 10);
      if (!isNaN(offset)) {
        const isRTL = currentLanguage === 'he' || currentLanguage === 'ar';
        const adjustedOffset = isRTL ? -offset : offset;
        const newPos = Math.max(0, Math.min(currentText.length, cursorPosition + adjustedOffset));
        setCursorPosition(newPos);
      }
      return;
    }

    // Handle language switch button
    if (type === 'language') {
      console.log('🌐 Language switch button pressed');
      cycleLanguage();
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
      await speak(currentText, 'detect', englishVoice, hebrewVoice, arabicVoice);
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

  // Handle favorite press - speak the text
  const handleFavoritePress = async (text: string) => {
    console.log('⭐ Favorite selected:', text);
    await speak(text, 'detect', englishVoice, hebrewVoice, arabicVoice);
  };

  // Function to cycle between selected languages
  const cycleLanguage = () => {
    const activeLangs = LANGUAGE_CYCLE_ORDER.filter(l => selectedLanguages.includes(l));
    if (activeLangs.length <= 1) return;
    const currentIndex = activeLangs.indexOf(currentLanguage);
    const nextIndex = (currentIndex + 1) % activeLangs.length;
    const newLanguage = activeLangs[nextIndex];
    console.log(`🌐 Switching language from ${currentLanguage} to ${newLanguage}`);
    setCurrentLanguage(newLanguage);
  };



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
          maxHeight: Math.min(availableHeight * 0.3, frame.height * 0.18) + favoritesUnusedHeight,
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
            isLandscape={isLandscape}
            isTablet={Math.min(frame.width, frame.height) >= 600}
            symbolsInSuggestions={symbolsInSuggestions}
            onUnusedHeight={setFavoritesUnusedHeight}
          />
        )}

        {/* Unified Keyboard + Suggestions Container */}
        <View style={[styles.keyboardWrapper, { backgroundColor: keyboardBgColor }]}>
          {/* IssieBoard Custom Keyboard */}
          <View style={{ height: keyboardHeight }}>
            <KeyboardPreview
              style={[styles.keyboard, { height: keyboardHeight }]}
              configJson={keyboardConfig}
              language={currentLanguage}
              text={currentText}
              hideGlobeButton
              onKeyPress={handleKeyPress}
              onHeightChange={(e) => {
                const newHeight = e.nativeEvent.height;
                console.log('⌨️ Keyboard reported height:', newHeight);
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