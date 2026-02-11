import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {useText} from '../context/TextContext';
import {useTTS} from '../context/TTSContext';
import TextDisplayArea from '../components/TextDisplayArea/TextDisplayArea';
import ActionBar from '../components/ActionBar/ActionBar';
import SuggestionsBar from '../components/SuggestionsBar/SuggestionsBar';
import {KeyboardPreview, KeyPressEvent} from '../../../../src/components/KeyboardPreview';
import {colors} from '../constants';

interface MainScreenProps {
  navigation: any;
}

const MainScreen: React.FC<MainScreenProps> = ({navigation}) => {
  const {currentText, setText, clearText} = useText();
  const {speak, isSpeaking} = useTTS();
  const [keyboardConfig, setKeyboardConfig] = useState<string>('');

  // Load default keyboard configuration (English)
  useEffect(() => {
    const loadKeyboardConfig = async () => {
      try {
        const config = require('../../../../keyboards/en.json');
        setKeyboardConfig(JSON.stringify(config));
      } catch (error) {
        console.error('Failed to load keyboard config:', error);
      }
    };
    loadKeyboardConfig();
  }, []);

  const handleKeyPress = (event: KeyPressEvent) => {
    const {type, value, label} = event.nativeEvent;
    console.log('🎹 Key pressed:', {type, value, label, currentLength: currentText.length});
    
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

  const handleSave = () => {
    // Navigate to save dialog or show modal
    // Implementation will be added
  };

  const handleBrowse = () => {
    navigation.navigate('Browse');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Text Display Area - Top */}
        <TextDisplayArea text={currentText} />

        {/* Suggestions Bar - Above Action Buttons */}
        <SuggestionsBar currentText={currentText} />

        {/* Action Buttons - Below Text Display */}
        <ActionBar
          onSpeak={handleSpeak}
          onClear={handleClear}
          onSave={handleSave}
          onBrowse={handleBrowse}
          isSpeaking={isSpeaking}
          hasText={currentText.length > 0}
        />

        {/* IssieBoard Custom Keyboard - Bottom */}
        <View style={styles.keyboardContainer}>
          <KeyboardPreview
            style={styles.keyboard}
            configJson={keyboardConfig}
            onKeyPress={handleKeyPress}
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
    height: 250,
    backgroundColor: colors.surface,
  },
  keyboard: {
    flex: 1,
    height: 250,
  },
});

export default MainScreen;