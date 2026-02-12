import React, {useRef, useEffect} from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import {useText} from '../../context/TextContext';
import {colors, sizes} from '../../constants';

interface TextDisplayAreaProps {
  text: string;
}

const TextDisplayArea: React.FC<TextDisplayAreaProps> = ({text}) => {
  const {setText} = useText();
  const textInputRef = useRef<TextInput>(null);

  // Log whenever text prop changes
  useEffect(() => {
    console.log('📺 TextDisplayArea received text:', text, 'length:', text.length);
  }, [text]);

  // Keep TextInput focused to show cursor
  // useEffect(() => {
  //   if (textInputRef.current) {
  //     textInputRef.current.focus();
  //   }
  // }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        keyboardShouldPersistTaps="handled">
        <TextInput
          ref={textInputRef}
          style={styles.textInput}
          value={text}
          onChangeText={(newText) => {
            console.log('⌨️ External keyboard input detected:', newText);
            setText(newText);
          }}
          multiline={true}
          editable={true}
          autoFocus
          placeholder="Start typing to compose your message..."
          placeholderTextColor={colors.textLight}
          inputAccessoryViewID="customKeyboard"
          showSoftInputOnFocus={false}
          caretHidden={false}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: sizes.textDisplay,
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
    fontSize: sizes.fontSize.large,
    color: colors.text,
    lineHeight: sizes.fontSize.large * 1.5,
    minHeight: sizes.textDisplay - (sizes.spacing.md * 2),
    textAlignVertical: 'top',
  },
});

export default TextDisplayArea;