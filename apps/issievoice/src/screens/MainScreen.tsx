import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Text,
} from 'react-native';
import {useText} from '../context/TextContext';
import {useTTS} from '../context/TTSContext';
import {useLocalization} from '../context/LocalizationContext';
import {useNotification} from '../context/NotificationContext';
import TextDisplayArea from '../components/TextDisplayArea/TextDisplayArea';
import ActionBar from '../components/ActionBar/ActionBar';
import SuggestionsBar from '../components/SuggestionsBar/SuggestionsBar';
import {KeyboardPreview, KeyPressEvent} from '../../../../src/components/KeyboardPreview';
import {colors} from '../constants';
import SavedSentencesManager from '../services/SavedSentencesManager';

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
  const keyboardConfigRef = useRef<any>(null);

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
  const loadKeyboardConfig = (language: string) => {
    try {
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
      
      const mergedCommonKeysets = commonKeysets.map((keyset: any) => ({
        ...keyset,
        rows: [...keyset.rows, bottomRow],
      }));
      
      // Combine language-specific keysets with merged common keysets
      const allKeysets = [...config.keysets, ...mergedCommonKeysets];
      console.log('📋 All keysets:', allKeysets.map((k: any) => k.id));
      
      // Add IssieVoice-specific settings to the config
      const issieVoiceConfig = {
        ...config,
        keysets: allKeysets,
        keyHeight: 74, // Use iPad-sized keys for better visibility
        fontSize: 32, // Larger font size for better readability
        language: language, // Set the language for suggestions
        groups: [
          ...(config.groups || []),
          {
            items: ['settings', 'close'],
            template: {
              visibilityMode: 'hide',
            },
          },
        ],
      };
      
      console.log('📋 Final config keysets:', issieVoiceConfig.keysets.map((k: any) => k.id));
      
      // Store the config object for height calculations
      keyboardConfigRef.current = issieVoiceConfig;
      
      // Calculate appropriate keyboard height
      calculateKeyboardHeight(issieVoiceConfig);
      
      setKeyboardConfig(JSON.stringify(issieVoiceConfig));
    } catch (error) {
      console.error('❌ Failed to load keyboard config:', error);
    }
  };
  
  // Effect for loading keyboard config when language changes
  useEffect(() => {
    console.log(`🔄 Language change effect triggered: ${currentLanguage}`);
    loadKeyboardConfig(currentLanguage);
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
      await speak(currentText);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Text Display Area - Top */}
        <TextDisplayArea text={currentText} />

        {/* Suggestions Bar - Above Action Buttons */}
        <SuggestionsBar 
          currentText={currentText} 
          kbSuggestions={kbSuggestions} 
          language={currentLanguage}
          onSuggestionPress={handleSuggestionFromBar}
        />

        {/* Action Buttons - Below Text Display */}
        <View style={styles.actionsContainer}>
          <ActionBar
            onSpeak={handleSpeak}
            onClear={handleClear}
            onSave={handleSave}
            onBrowse={handleBrowse}
            onSwitchLanguage={toggleLanguage}
            isSpeaking={isSpeaking}
            hasText={currentText.length > 0}
            currentLanguage={currentLanguage}
          />
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