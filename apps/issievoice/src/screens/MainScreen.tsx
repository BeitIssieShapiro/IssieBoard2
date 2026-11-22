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
import { nikkudMergeBackspaceCount } from '../utils/nikkudMerge';
import { detectTextDirection } from '../utils/textDirection';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';
import { LANGUAGE_CYCLE_ORDER, KbLanguage } from '../components/Settings/LanguageSettingsPanel';

interface MainScreenProps {
  navigation: any;
}

const NON_VOICE_KEY_TYPES = ['next-keyboard', 'close', 'settings'];

const isBottomRow = (row: any) =>
  row.alwaysInclude || row.keys.some((k: any) => k.type === 'space' || k.value === ' ');

// Label of the language key: the NEXT language in the cycle, or '' when there is only one.
const getLanguageKeyLabel = (language: KbLanguage, selectedLanguages: KbLanguage[]): string => {
  const activeLangs = LANGUAGE_CYCLE_ORDER.filter(l => selectedLanguages.includes(l));
  if (activeLangs.length <= 1) return '';
  const nextLang = activeLangs[(activeLangs.indexOf(language) + 1) % activeLangs.length];
  switch (nextLang) {
    case 'he': return 'עב';
    case 'en': return 'En';
    case 'ar': return 'عر';
  }
};

// Drop the system-keyboard-only keys and add (or relabel) the language switch key
// right after the first key of the bottom row.
const injectLanguageKey = (keysets: any[], langLabel: string, groups?: any[]) => {
  // Only use the default color if no style group targets the language key
  const hasLangGroup = groups?.some((g: any) => g.items?.includes('language'));
  const languageKey = {
    type: 'language',
    label: langLabel,
    caption: langLabel,
    value: '',
    width: 1,
    ...(hasLangGroup ? {} : { bgColor: colors.primary }),
  };

  return keysets.map((keyset: any) => ({
    ...keyset,
    rows: keyset.rows.map((row: any) => {
      const filteredKeys = row.keys.filter((key: any) => !NON_VOICE_KEY_TYPES.includes(key.type));
      if (!langLabel || !isBottomRow(row)) {
        return { ...row, keys: filteredKeys };
      }
      if (row.keys.some((k: any) => k.type === 'language')) {
        return { ...row, keys: filteredKeys.map((k: any) =>
          k.type === 'language' ? { ...k, label: langLabel, caption: langLabel } : k
        )};
      }
      const newKeys = [...filteredKeys];
      newKeys.splice(1, 0, languageKey);
      return { ...row, keys: newKeys };
    }),
  }));
};

// Replace the enter key of the bottom row with speak, or append speak if there is no enter.
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

  return keysets.map((keyset: any) => ({
    ...keyset,
    rows: keyset.rows.map((row: any) => {
      if (!isBottomRow(row)) return row;
      const newKeys = [...row.keys];
      const enterIndex = newKeys.findIndex((k: any) => k.type === 'enter');
      if (enterIndex >= 0) {
        newKeys[enterIndex] = speakKey;
      } else {
        newKeys.push(speakKey);
      }
      return { ...row, keys: newKeys };
    }),
  }));
};

// The keyboard the user saved for IssieVoice in this language, or null if none.
const loadSavedConfig = async (language: KbLanguage): Promise<any | null> => {
  const activeProfile = await KeyboardPreferences.getProfile(`active_profile_issievoice_${language}`);
  if (!activeProfile) return null;
  // getString, not getProfile: this key is saved without the profile_ prefix
  const savedConfigJson = await KeyboardPreferences.getString(`keyboardConfig_issievoice_${language}`);
  if (!savedConfigJson) return null;
  try {
    return JSON.parse(savedConfigJson);
  } catch (parseError) {
    console.warn('⚠️ Failed to parse saved config, falling back to default:', parseError);
    return null;
  }
};

// The built-in keyboard, built with the same merger IssieBoard uses, at IssieVoice's
// accessible defaults.
const buildDefaultConfig = (language: KbLanguage): any => {
  let sourceKeyboard;
  if (language === 'en') {
    sourceKeyboard = require('../../../../keyboards/en.json');
  } else if (language === 'ar') {
    sourceKeyboard = require('../../../../keyboards/ar.json');
  } else {
    sourceKeyboard = require('../../../../keyboards/he.json');
  }
  return {
    ...buildKeyboardConfig(sourceKeyboard, language),
    heightPreset: 'tall',
    fontSizePreset: 'large',
  };
};

const MainScreen: React.FC<MainScreenProps> = ({ navigation }) => {
  const { currentText, setText, setCursorPosition, moveCursorBy, getCursorPosition } = useText();
  const { speak, stop, isSpeaking } = useTTS();
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
  const [speakButtonInKeyboard, setSpeakButtonInKeyboard] = useState(false);
  const [symbolsInSuggestions, setSymbolsInSuggestions] = useState(false);
  // Bumped on every focus so the keyboard picks up a profile saved in settings
  const [configReloadToken, setConfigReloadToken] = useState(0);
  const currentLanguageRef = useRef<KbLanguage | null>(null);
  currentLanguageRef.current = languagesLoaded ? currentLanguage : null;

  // Get window dimensions using useSafeAreaFrame (works with ScreenSizer)
  const frame = useSafeAreaFrame();
  const insets = useSafeAreaInsets();

  const availableHeight = frame.height - insets.top - insets.bottom - keyboardHeight;

  // Determine if landscape or portrait
  const isLandscape = frame.width > frame.height;
  const isPhoneLandscape = isLandscape && Math.min(frame.width, frame.height) < 600;
  const isRTL = deviceLanguage === 'he' || deviceLanguage === 'ar';

  // Load all preferences on mount and whenever returning from settings, then apply
  // them in one go so the keyboard config is rebuilt once, not once per setting.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      const loadPrefs = async () => {
        let langs: KbLanguage[] = ['he', 'en'];
        let lastLang: string | null = null;
        let enVoice: string | null = null;
        let heVoice: string | null = null;
        let arVoice: string | null = null;
        let speakInKb: string | null = null;
        let symbolsVal: string | null = null;
        try {
          const savedLangs = await KeyboardPreferences.getString('issievoice_selectedLanguages');
          if (savedLangs) {
            const parsed = JSON.parse(savedLangs) as KbLanguage[];
            if (parsed.length > 0) langs = parsed;
          }
          lastLang = await KeyboardPreferences.getString('issievoice_lastLanguage');
          enVoice = await KeyboardPreferences.getProfile('issievoice_englishVoice');
          heVoice = await KeyboardPreferences.getProfile('issievoice_hebrewVoice');
          arVoice = await KeyboardPreferences.getProfile('issievoice_arabicVoice');
          speakInKb = await KeyboardPreferences.getString('issievoice_speakButtonInKeyboard');
          symbolsVal = await KeyboardPreferences.getString('issievoice_symbolsInSuggestions');
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
        if (cancelled) return;

        // Keep the current language unless it was deselected; on first load use the
        // last one used, else the device language, else the first selected.
        const current = currentLanguageRef.current;
        let language: KbLanguage = langs[0];
        if (current && langs.includes(current)) {
          language = current;
        } else if (!current && lastLang && langs.includes(lastLang as KbLanguage)) {
          language = lastLang as KbLanguage;
        } else if (!current && langs.includes(deviceLanguage as KbLanguage)) {
          language = deviceLanguage as KbLanguage;
        }

        setSelectedLanguages(prev => (prev.join() === langs.join() ? prev : langs));
        setCurrentLanguage(language);
        if (enVoice) setEnglishVoice(enVoice);
        if (heVoice) setHebrewVoice(heVoice);
        if (arVoice) setArabicVoice(arVoice);
        setSpeakButtonInKeyboard(speakInKb === 'true');
        setSymbolsInSuggestions(symbolsVal === 'true');
        setLanguagesLoaded(true);
        setConfigReloadToken(t => t + 1);
        setFavoritesReloadTrigger(t => t + 1);
      };
      loadPrefs();
      return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Persist last language
  useEffect(() => {
    if (languagesLoaded) {
      KeyboardPreferences.setString('issievoice_lastLanguage', currentLanguage);
    }
  }, [currentLanguage, languagesLoaded]);

  // Re-measure the keyboard only when its layout really changes, not on every reload
  useEffect(() => {
    setKeyboardHeight(350);
  }, [currentLanguage, speakButtonInKeyboard]);

  // Build the keyboard config: the saved profile if there is one, else the default,
  // plus IssieVoice's own keys (language switch, optional speak).
  useEffect(() => {
    if (!languagesLoaded) return;
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const savedConfig = await loadSavedConfig(currentLanguage);
        const config = savedConfig ?? buildDefaultConfig(currentLanguage);
        const langLabel = getLanguageKeyLabel(currentLanguage, selectedLanguages);
        let keysets = injectLanguageKey(config.keysets, langLabel, config.groups);
        if (speakButtonInKeyboard) {
          keysets = injectSpeakKey(keysets, strings.actionBar.speak.trim(), config.groups);
        }
        const finalConfig = { ...config, keysets, language: currentLanguage };
        if (cancelled) return;
        const bg = finalConfig.backgroundColor;
        setKeyboardBgColor(!bg || bg === 'default' ? defaultKbBg : bg);
        setKeyboardConfig(JSON.stringify(finalConfig));
      } catch (error) {
        console.error('❌ Failed to load keyboard config:', error);
      }
    };
    loadConfig();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languagesLoaded, currentLanguage, speakButtonInKeyboard, selectedLanguages, configReloadToken]);

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
      // Read the live caret, not the `cursorPosition` state: a space-swipe emits a
      // burst of cursor moves faster than React commits, so the state value can
      // still be stale here — which would splice the text at the wrong offset and
      // inspect the wrong preceding letter for the nikkud merge.
      const pos = getCursorPosition();
      const after = currentText.slice(pos);

      if (prevLength != null && deletedTo != null) {
        // Use precise delta from native
        const deleted = prevLength - deletedTo;
        const inserted = engineText.slice(deletedTo);
        const deleteFrom = Math.max(0, pos - deleted);
        let newBefore = currentText.slice(0, deleteFrom);
        // If the picker produced a letter+nikkud and the caret sits right after that
        // same bare letter, vocalize the existing letter instead of inserting a
        // duplicate. Native can't do this: it has no caret and treats the buffer as
        // append-only, so the merge has to happen here where the caret is known.
        //
        // Only mid-word: at the end of the text the user is appending a new letter,
        // not editing the one already there, so "א" then picking "אֵ" must give "אאֵ".
        const atEndOfText = deleteFrom >= currentText.length;
        if (!atEndOfText) {
          const merge = nikkudMergeBackspaceCount(newBefore, inserted);
          if (merge > 0) {
            newBefore = newBefore.slice(0, newBefore.length - merge);
          }
        }
        const newText = newBefore + inserted + after;
        const newCursor = newBefore.length + inserted.length;
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
        // Follow the direction the *text* is rendered in, not the keyboard
        // language: typing "Abc" on a Hebrew keyboard displays LTR, so a swipe
        // must map to string indices the same way TextDisplayArea lays it out.
        const isRTL = currentText
          ? detectTextDirection(currentText) === 'rtl'
          : currentLanguage === 'he' || currentLanguage === 'ar';
        const adjustedOffset = isRTL ? -offset : offset;
        // Relative move: a swipe emits many events faster than React commits state,
        // so each must build on the previous one rather than on a stale cursorPosition.
        moveCursorBy(adjustedOffset, currentText.length);
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
    const pos = getCursorPosition();
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

  // Speak toggles: tapping while speaking stops instead of queueing another reading
  const handleSpeak = async () => {
    if (isSpeaking) {
      await stop();
    } else if (currentText.trim()) {
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
      <View style={[styles.content, { paddingBottom: keyboardHeight + 24 }]}>
        {/* Header Bar */}
        <View style={[styles.headerBar, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.navigate('Settings', { initialLanguage: currentLanguage })}
            activeOpacity={0.7}>
            <Text style={styles.menuButtonText}>☰</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isRTL && { marginLeft: 0, marginRight: 12 }]}>{strings.app.title}</Text>
        </View>

        {/* Text Area Row */}
        <View style={[styles.textAreaRow, isRTL && { flexDirection: 'row-reverse' }]}>
          {/* Text Area with Floating Speak Button */}
          <View style={styles.textAreaContainer}>
            <View style={{ flex: 1 }}>
              <TextDisplayArea
                text={currentText}
                screenWidth={frame.width}
                speakButtonPadding={speakButtonInKeyboard ? 0 : 50}
                onSave={handleSave}
                onBrowse={() => navigation.navigate('Browse')}
              />
            </View>

            {/* Floating Speak Button - hidden when speak is in keyboard */}
            {!speakButtonInKeyboard && (
            <View style={[styles.speakFabWrapper, isRTL && { right: undefined, left: 14 }]} pointerEvents="box-none">
              <TouchableOpacity
                style={[styles.speakFab, isRTL && { flexDirection: 'row-reverse' }]}
                onPress={handleSpeak}
                activeOpacity={0.7}>
                <MyIcon info={{ name: isSpeaking ? 'stop' : 'record-voice-over', type: 'MI', color: '#FFFFFF', size: 20 }} />
                <Text style={styles.speakFabLabel}>{isSpeaking ? strings.actionBar.stop : strings.actionBar.speak}</Text>
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
                setKeyboardHeight(e.nativeEvent.height);
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