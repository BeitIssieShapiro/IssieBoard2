import React, {useRef, useEffect, useMemo} from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import {useText} from '../../context/TextContext';
import {colors, sizes} from '../../constants';
import {useLocalization} from '../../context/LocalizationContext';
import {detectTextDirection} from '../../utils/textDirection';

interface TextDisplayAreaProps {
  text: string;
  height?: number; // Optional responsive height
}

const TextDisplayArea: React.FC<TextDisplayAreaProps> = ({text, height = sizes.textDisplay}) => {
  const {setText} = useText();
  const {strings} = useLocalization();
  const textInputRef = useRef<TextInput>(null);

  // Dynamically detect text direction based on content
  const textDirection = useMemo(() => detectTextDirection(text), [text]);
  const isTextRTL = textDirection === 'rtl';

  // Calculate font size based on container height (scale proportionally)
  const scaleFactor = height / sizes.textDisplay;
  const fontSize = Math.max(18, sizes.fontSize.large * scaleFactor);
  const lineHeight = fontSize * 1.5;

  // Log whenever text prop changes
  useEffect(() => {
    console.log('📺 TextDisplayArea received text:', text, 'length:', text.length, 'direction:', textDirection);
  }, [text, textDirection]);

  // Keep TextInput focused to show cursor
  // useEffect(() => {
  //   if (textInputRef.current) {
  //     textInputRef.current.focus();
  //   }
  // }, []);

  return (
    <View style={[styles.container, {height}]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        keyboardShouldPersistTaps="handled">
        <TextInput
          ref={textInputRef}
          style={[
            styles.textInput,
            {fontSize, lineHeight, minHeight: height - (sizes.spacing.md * 2)},
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
          writingDirection={textDirection}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: sizes.spacing.md,
    flexGrow: 1,
  },
  textInput: {
    color: colors.text,
    textAlignVertical: 'top',
    textAlign: 'left',
  },
  textInputRTL: {
    textAlign: 'right',
  },
});

export default TextDisplayArea;