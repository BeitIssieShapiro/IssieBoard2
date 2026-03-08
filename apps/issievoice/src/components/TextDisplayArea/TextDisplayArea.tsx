import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useText } from '../../context/TextContext';
import { colors, sizes } from '../../constants';
import { useLocalization } from '../../context/LocalizationContext';
import { detectTextDirection } from '../../utils/textDirection';

interface TextDisplayAreaProps {
  text: string;
  screenWidth?: number; // Optional screen width for responsive scaling
}

const TextDisplayArea: React.FC<TextDisplayAreaProps> = ({ text, screenWidth = 1000 }) => {
  const { setText } = useText();
  const { strings, isRTL } = useLocalization();
  const textInputRef = useRef<TextInput>(null);

  // Dynamically detect text direction based on content
  const textDirection = useMemo(() => detectTextDirection(text), [text]);
  const isTextRTL = textDirection === 'rtl';

  // Calculate font size based on screen width (scales from 1000px reference)
  // At 1000px: fontSize = 36 (sizes.fontSize.xxlarge)
  // Scales proportionally but never below 20px
  const baseFontSize = sizes.fontSize.xxlarge; // ~36
  const scaleFactor = screenWidth / 1000;
  const fontSize = Math.max(20, baseFontSize * scaleFactor);
  const lineHeight = fontSize * 1.5;

  // Log whenever text prop changes
  useEffect(() => {
    console.log('📺 TextDisplayArea received text:', text, 'length:', text.length, 'direction:', textDirection);
  }, [text, textDirection]);

  const handleClear = () => {
    setText('');
  };

  return (
    <View style={[styles.container, { height:"100%" }]}>
      <TextInput
        ref={textInputRef}
        style={[
          styles.textInput,
          { fontSize, lineHeight, height: '100%' },
          isTextRTL && styles.textInputRTL,
        ]}
        value={text}
        onChangeText={(newText) => {
          console.log('⌨️ External keyboard input detected:', newText);
          setText(newText);
        }}
        multiline={true}
        editable={true}
        autoFocus
        placeholder={strings.textPlaceholder}
        placeholderTextColor={colors.textLight}
        inputAccessoryViewID="customKeyboard"
        showSoftInputOnFocus={false}
        caretHidden={false}
        // @ts-ignore - writingDirection exists but not in types
        writingDirection={textDirection}
      />
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
});

export default TextDisplayArea;