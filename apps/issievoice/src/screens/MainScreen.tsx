import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Text,
  Dimensions,
} from 'react-native';
import {useText} from '../context/TextContext';
import {useTTS} from '../context/TTSContext';
import {useLocalization} from '../context/LocalizationContext';
import {useNotification} from '../context/NotificationContext';
import {useFocusEffect} from '@react-navigation/native';
import TextDisplayArea from '../components/TextDisplayArea/TextDisplayArea';
import ActionBar from '../components/ActionBar/ActionBar';
import SuggestionsBar from '../components/SuggestionsBar/SuggestionsBar';
import SettingsModal from '../components/SettingsModal/SettingsModal';
import {KeyboardPreview, KeyPressEvent} from '../../../../src/components/KeyboardPreview';
import {colors, sizes} from '../constants';
import SavedSentencesManager from '../services/SavedSentencesManager';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

interface MainScreenProps {
  navigation: any;
}

const MainScreen: React.FC<MainScreenProps> = ({navigation}) => {
  const {currentText, setText, clearText} = useText();
  const {speak, isSpeaking, setLanguage: setTTSLanguage} = useTTS();
  const {strings, language: deviceLanguage} = useLocalization();
  const {showNotification} = useNotification();
  const [keyboardConfig, setKeyboardConfig] = useState<string>('');
  const [kbSuggestions, setKbSuggestions] = useState<string[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(350);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'he'>(deviceLanguage);
  const [languageMode, setLanguageMode] = useState<'en-only' | 'he-only' | 'detect'>('detect');
  const [englishVoice, setEnglishVoice] = useState<string | undefined>(undefined);
  const [hebrewVoice, setHebrewVoice] = useState<string | undefined>(undefined);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const keyboardConfigRef = useRef<any>(null);

  // Calculate responsive sizes based on keyboard height
  // Layout: no title, flexible text, fixed 50px suggestions, remaining for buttons
  const responsiveSizes = React.useMemo(() => {
    const screenHeight = Dimensions.get('window').height;
    const bottomPadding = 20; // Extra space below keyboard
    const availableHeight = screenHeight - keyboardHeight - bottomPadding;

    // Fixed sizes
    const suggestionBarHeight = 50; // Fixed size as requested
    const minTextDisplayHeight = 80;
    const minActionButtonHeight = 50;

    // All available height minus suggestions
    const remainingHeight = availableHeight - suggestionBarHeight;

    // Split remaining height: ~65% for text, ~35% for buttons
    const textDisplayHeight = Math.max(remainingHeight * 0.65, minTextDisplayHeight);
    const actionButtonHeight = Math.max(remainingHeight * 0.35, minActionButtonHeight);

    console.log('📐 Layout calculation:', {
      screenHeight,
      keyboardHeight,
      bottomPadding,
      availableHeight,
      textDisplayHeight,
      suggestionBarHeight,
      actionButtonHeight,
      totalContent: textDisplayHeight + suggestionBarHeight + actionButtonHeight,
    });

    return {
      textDisplayHeight,
      suggestionBarHeight,
      actionButtonHeight,
    };
  }, [keyboardHeight]);

  // Calculate appropriate keyboard height based on configuration
  const calculateKeyboardHeight = (config: any) => {
    if (!config) return;
    
    // Base height per row (using config.keyHeight if available, or default to 74)
    const keyHeight = config.keyHeight || 74;
    
    // Count the maximum number of rows across all keysets
    let maxRows = 0;
    config.keysets.forEach((keyset: any) => {
      const rowCount = keyset.rows.length;
      if (rowCount > maxRows) maxRows = rowCount;
    });
    
    // Calculate total height (rows + spacing + padding)
    // Each row is keyHeight tall, plus some spacing between rows,
    // plus padding at top and bottom
    const rowSpacing = 0; // Same as in KeyboardRenderer.swift
    const topPadding = 4; 
    const bottomPadding = 4;
    
    // Note: We don't add height for suggestions bar because it's a separate component
    // outside of the keyboard container. The SuggestionsBar component maintains its
    // own consistent height of 50px even when empty.
    const additionalSpacing = 12; // Extra buffer to ensure nothing is cut off
    
    const totalHeight = (maxRows * keyHeight) + 
                       ((maxRows - 1) * rowSpacing) + 
                       topPadding + 
                       bottomPadding +
                       additionalSpacing;
    
    console.log(`📏 Calculated keyboard height: ${totalHeight}px (${maxRows} rows of ${keyHeight}px)`);
    
    // Set minimum height to avoid issues with very small keyboard layouts
    const minHeight = 300;
    const finalHeight = Math.max(totalHeight, minHeight);
    
    setKeyboardHeight(finalHeight);
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

            console.log(`🔑 Creating language key for ${language} keyboard:`, languageKey);

            // Update all keysets to include language switch key and remove close/next-keyboard
            savedConfig.keysets = savedConfig.keysets.map((keyset: any) => ({
              ...keyset,
              rows: keyset.rows.map((row: any, rowIndex: number) => {
                // Check if this is the bottom row by looking for space key or if it's the last row with control keys
                const hasSpaceKey = row.keys.some((k: any) => k.type === 'space' || k.value === ' ');
                const hasControlKeys = row.keys.some((k: any) =>
                  k.type === 'keyset' || k.type === 'next-keyboard' || k.type === 'close'
                );
                const isBottomRow = row.alwaysInclude || hasSpaceKey || (hasControlKeys && rowIndex === keyset.rows.length - 1);

                if (isBottomRow) {
                  // Check if language key already exists
                  const hasLanguageKey = row.keys.some((k: any) => k.type === 'language');

                  // Always filter out unwanted keys
                  const filteredKeys = row.keys.filter((key: any) =>
                    key.type !== 'next-keyboard' && key.type !== 'close'
                  );

                  if (!hasLanguageKey) {
                    // Add language key after first key (usually 123 button)
                    const newKeys = filteredKeys.reduce((acc: any[], key: any, index: number) => {
                      acc.push(key);
                      if (index === 0) {
                        acc.push(languageKey);
                      }
                      return acc;
                    }, []);
                    return { ...row, keys: newKeys };
                  } else {
                    // Language key exists, just use filtered keys
                    return { ...row, keys: filteredKeys };
                  }
                }
                return row;
              }),
            }));

            // Store the config object for height calculations
            keyboardConfigRef.current = savedConfig;
            calculateKeyboardHeight(savedConfig);

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

      console.log('📋 Modified bottom row keys:', modifiedBottomRow.keys.length);
      console.log('📋 Modified bottom row keys types:', modifiedBottomRow.keys.map((k: any) => k.type || k.value));

      const mergedCommonKeysets = commonKeysets.map((keyset: any) => ({
        ...keyset,
        rows: [...keyset.rows, modifiedBottomRow],
      }));

      // Also modify the original language-specific keysets
      const modifiedLanguageKeysets = config.keysets.map((keyset: any) => ({
        ...keyset,
        rows: keyset.rows.map((row: any) => {
          if (row.alwaysInclude) {
            // This is the bottom row - remove next-keyboard and close, insert language key after first key
            return {
              ...row,
              keys: row.keys
                .filter((key: any) => key.type !== 'next-keyboard' && key.type !== 'close')
                .reduce((acc: any[], key: any, index: number) => {
                  acc.push(key);
                  if (index === 0) {
                    acc.push(languageKey);
                  }
                  return acc;
                }, []),
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
        keyHeight: 74, // Use iPad-sized keys for better visibility
        fontSize: 32, // Larger font size for better readability
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
      
      // Calculate appropriate keyboard height
      calculateKeyboardHeight(issieVoiceConfig);

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
      await loadKeyboardConfig(currentLanguage);
    };
    loadConfig();
  }, [currentLanguage]);
  
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
      console.log('📱 MainScreen focused - reloading keyboard config');
      const reloadConfig = async () => {
        await loadKeyboardConfig(currentLanguage);
      };
      reloadConfig();
    }, [currentLanguage])
  );

  // No need for a separate initial load effect as the above effect will run on mount

  const handleKeyPress = (event: KeyPressEvent) => {
    const {type, value, label} = event.nativeEvent;
    console.log('🎹 Key pressed:', {type, value, label, keysetValue: event.nativeEvent.keysetValue, currentLength: currentText.length});

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
      console.log('❓ Unhandled key:', {type, value, label});
    }
  };

  const handleSpeak = async () => {
    if (currentText.trim()) {
      await speak(currentText, languageMode, englishVoice, hebrewVoice);
    }
  };

  const handleClear = () => {
    clearText();
  };

  const handleSave = async () => {
    if (!currentText.trim()) {
      return;
    }

    try {
      await SavedSentencesManager.saveSentence(currentText);
      showNotification(strings.savedSuccessMessage, 'success');
    } catch (error) {
      showNotification(strings.failedToSave, 'error');
      console.error('Save error:', error);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Settings Button - Absolute Position Top Right */}
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setSettingsModalVisible(true)}
          activeOpacity={0.7}>
          <Text style={styles.settingsButtonText}>☰</Text>
        </TouchableOpacity>

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

        {/* Scrollable content area that shrinks when keyboard grows */}
        <View style={[
          styles.scrollableContent,
          {
            height: responsiveSizes.textDisplayHeight +
                    responsiveSizes.suggestionBarHeight +
                    responsiveSizes.actionButtonHeight
          }
        ]}>
          {/* Text Display Area - Top */}
          <TextDisplayArea
            text={currentText}
            height={responsiveSizes.textDisplayHeight}
          />

          {/* Suggestions Bar - Above Action Buttons */}
          <SuggestionsBar
            currentText={currentText}
            kbSuggestions={kbSuggestions}
            language={currentLanguage}
            onSuggestionPress={handleSuggestionFromBar}
            height={responsiveSizes.suggestionBarHeight}
          />

          {/* Action Buttons - Below Text Display */}
          <View style={styles.actionsContainer}>
            <ActionBar
              onSpeak={handleSpeak}
              onClear={handleClear}
              onSave={handleSave}
              onBrowse={handleBrowse}
              isSpeaking={isSpeaking}
              hasText={currentText.length > 0}
              currentLanguage={currentLanguage}
              buttonHeight={responsiveSizes.actionButtonHeight}
            />
          </View>
        </View>

        {/* IssieBoard Custom Keyboard - Bottom */}
        <View style={[styles.keyboardContainer, { height: keyboardHeight }]}>
          <KeyboardPreview
            style={[styles.keyboard, { height: keyboardHeight }]}
            configJson={keyboardConfig}
            language={currentLanguage}
            text={currentText}
            onKeyPress={handleKeyPress}
            onSuggestionsChange={handleSuggestionsChange}
            onOpenSettings={handleOpenSettings}
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
  settingsButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: sizes.borderRadius.medium,
    zIndex: 1000,
  },
  settingsButtonText: {
    fontSize: 28,
  },
  scrollableContent: {
    // Remove flex, use fixed height instead
  },
  keyboardContainer: {
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