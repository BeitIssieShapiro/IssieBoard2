import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  InputAccessoryView,
} from 'react-native';
import { useText } from '../../context/TextContext';
import { useTTS } from '../../context/TTSContext';
import { colors, sizes } from '../../constants';
import { useLocalization } from '../../context/LocalizationContext';
import { detectTextDirection } from '../../utils/textDirection';

interface TextDisplayAreaProps {
  text: string;
  screenWidth?: number; // Optional screen width for responsive scaling
  speakButtonPadding?: number; // Extra bottom-right padding for floating speak button
}

const TextDisplayArea: React.FC<TextDisplayAreaProps> = ({ text, screenWidth = 1000, speakButtonPadding = 0 }) => {
  const { setText, cursorPosition, setCursorPosition, pendingSelection, clearPendingSelection } = useText();
  const { isSpeaking, spokenRange } = useTTS();
  const { strings, isRTL, language } = useLocalization();
  const textInputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);

  // Dynamically detect text direction based on content
  // If text is empty, use the current language direction
  const textDirection = useMemo(() => {
    if (text.length === 0) {
      return language === 'he' ? 'rtl' : 'ltr';
    }
    return detectTextDirection(text);
  }, [text, language]);
  const isTextRTL = textDirection === 'rtl';

  // Calculate font size based on screen width (scales from 1000px reference)
  // At 1000px: fontSize = 24, scales proportionally but never below 16px
  const baseFontSize = 24;
  const scaleFactor = screenWidth / 1000;
  const fontSize = Math.max(16, baseFontSize * scaleFactor);
  const lineHeight = fontSize * 1.4;

  // Re-focus after text changes from our custom keyboard
  useEffect(() => {
    textInputRef.current?.focus();
  }, [text]);

  // Apply pending selection (e.g. after suggestion press) then release control
  useEffect(() => {
    if (pendingSelection !== null) {
      setSelection({ start: pendingSelection, end: pendingSelection });
      clearPendingSelection();
      // Release controlled selection after it's applied
      const timer = setTimeout(() => setSelection(undefined), 50);
      return () => clearTimeout(timer);
    }
  }, [pendingSelection]);

  const handleClear = () => {
    setText('');
  };

  // Build highlighted text segments when speaking
  const renderHighlightedText = () => {
    if (!spokenRange || !text) {
      return <Text style={[styles.highlightText, { fontSize, lineHeight }, isTextRTL && styles.textInputRTL, speakButtonPadding > 0 && { paddingBottom: speakButtonPadding }]}>{text}</Text>;
    }

    const { location, length } = spokenRange;
    const before = text.substring(0, location);
    const highlighted = text.substring(location, location + length);
    const after = text.substring(location + length);

    return (
      <Text style={[styles.highlightText, { fontSize, lineHeight }, isTextRTL && styles.textInputRTL, speakButtonPadding > 0 && { paddingBottom: speakButtonPadding }]}>
        {before}
        <Text style={styles.highlightedWord}>{highlighted}</Text>
        {after}
      </Text>
    );
  };

  return (
    <View style={[styles.container, { height:"100%" }]}>
      <TextInput
        ref={textInputRef}
        style={[
          styles.textInput,
          { fontSize, lineHeight, height: '100%' },
          isTextRTL && styles.textInputRTL,
          isSpeaking && styles.hiddenTextInput,
          speakButtonPadding > 0 && { paddingBottom: speakButtonPadding },
        ]}
        value={text}
        onChangeText={(newText) => {
          console.log('⌨️ External keyboard input detected:', newText);
          setText(newText);
        }}
        onSelectionChange={(e) => {
          if (pendingSelection === null) {
            setCursorPosition(e.nativeEvent.selection.start);
          }
        }}
        multiline={true}
        editable={true}
        autoFocus
        placeholder={strings.textDisplay.placeholder}
        placeholderTextColor={colors.textLight}
        inputAccessoryViewID="emptyAccessory"
        showSoftInputOnFocus={false}
        caretHidden={false}
        autoCorrect={false}
        spellCheck={false}
        selection={selection}
        // @ts-ignore - writingDirection exists but not in types
        writingDirection={textDirection}
      />
      <InputAccessoryView nativeID="emptyAccessory">
        <View />
      </InputAccessoryView>
      {isSpeaking && text.length > 0 && (
        <ScrollView style={styles.highlightOverlay} pointerEvents="none">
          {renderHighlightedText()}
        </ScrollView>
      )}
      {text.length > 0 && (
        <TouchableOpacity
          style={[styles.clearButton, isRTL ? styles.clearButtonLeft : styles.clearButtonRight]}
          onPress={handleClear}
          activeOpacity={0.7}>
          <Text style={styles.clearButtonText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 4,
    width: "100%",
    backgroundColor: '#FFFFFF',
    position: 'relative',
    justifyContent: 'flex-start',
  },

  scrollContent: {
    padding: sizes.spacing.md,
    flexGrow: 1,
  },
  textInput: {
    color: colors.text,
    textAlignVertical: 'top',
    textAlign: 'left',
    paddingTop: 8,
    paddingLeft: 8,
    paddingRight: 40, // Space for clear button
  },
  textInputRTL: {
    textAlign: 'right',
    paddingLeft: 40, // Space for clear button on left
    paddingRight: 8,
  },
  clearButton: {
    position: 'absolute',
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonRight: {
    right: 8,
  },
  clearButtonLeft: {
    left: 8,
  },
  clearButtonText: {
    color: colors.textLight,
    fontSize: 18,
    fontWeight: 'bold',
  },
  hiddenTextInput: {
    color: 'transparent',
  },
  highlightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  highlightText: {
    color: colors.text,
    textAlignVertical: 'top',
    textAlign: 'left',
    // iOS TextInput has ~4px extra internal content inset vs Text
    paddingTop: 17,
    paddingLeft: 8,
    paddingRight: 40,
  },
  highlightedWord: {
    backgroundColor: '#FFD700',
    color: '#000000',
    borderRadius: 4,
  },
});

export default TextDisplayArea;