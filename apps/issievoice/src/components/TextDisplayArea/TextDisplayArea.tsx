import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  InputAccessoryView,
  useWindowDimensions,
  NativeModules,
  Platform,
  findNodeHandle,
} from 'react-native';
import { useText } from '../../context/TextContext';
import { useTTS } from '../../context/TTSContext';
import { colors, sizes } from '../../constants';
import { useLocalization } from '../../context/LocalizationContext';
import { detectTextDirection } from '../../utils/textDirection';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';

interface TextDisplayAreaProps {
  text: string;
  screenWidth?: number; // Optional screen width for responsive scaling
  speakButtonPadding?: number; // Extra bottom-right padding for floating speak button
  onSave?: () => void;
  onBrowse?: () => void;
}

const TextDisplayArea: React.FC<TextDisplayAreaProps> = ({ text, screenWidth = 1000, speakButtonPadding = 0, onSave, onBrowse }) => {
  const { setText, cursorPosition, setCursorPosition, pendingSelection, clearPendingSelection } = useText();
  const { isSpeaking, spokenRange, spokenText } = useTTS();
  const { strings, isRTL, language } = useLocalization();
  const textInputRef = useRef<TextInput>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  // True while the user has a non-empty range selected by touch. Used to avoid
  // yanking focus (and thus the selection) out from under them on re-render.
  const hasUserSelectionRef = useRef(false);
  // Last text value we re-focused for, so caret-only updates don't re-trigger focus.
  const lastFocusedTextRef = useRef(text);
  const {width: winW, height: winH} = useWindowDimensions();
  const isPhoneLandscape = winW > winH && Math.min(winW, winH) < 500;

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
  // On phone landscape, use smaller font to fit in limited vertical space
  const baseFontSize = isPhoneLandscape ? 18 : 32;
  const scaleFactor = screenWidth / 1000;
  const fontSize = Math.max(isPhoneLandscape ? 14 : 16, baseFontSize * scaleFactor);
  const lineHeight = fontSize * (isPhoneLandscape ? 1.0 : 1.4);

  // Re-focus after text changes from our custom keyboard.
  // Only when the text actually changed AND the input isn't already focused:
  // calling focus() on an already-focused UITextView resets the caret to its
  // previous position, which would undo a tap the user just made to reposition it.
  useEffect(() => {
    if (text === lastFocusedTextRef.current) return;
    lastFocusedTextRef.current = text;
    if (textInputRef.current?.isFocused()) return;
    textInputRef.current?.focus();
  }, [text]);

  // Strip dictation mic and system keyboard from the native UITextView
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const timer = setTimeout(() => {
      const tag = findNodeHandle(textInputRef.current);
      if (tag) {
        NativeModules.KeyboardDisabler?.disableSystemKeyboard(tag);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Apply a programmatic caret move (suggestion press, space-swipe cursor move).
  // Control is released in onSelectionChange once the TextInput echoes the move
  // back, rather than on a timer: a swipe emits moves continuously, and a timed
  // release would clear the controlled selection between two moves whenever the
  // user swiped slowly, dropping that part of the gesture.
  useEffect(() => {
    if (pendingSelection !== null) {
      const {pos} = pendingSelection;
      setSelection({ start: pos, end: pos });
      // A programmatic move collapses any previous range selection.
      hasUserSelectionRef.current = false;
      clearPendingSelection();
    }
  }, [pendingSelection]);

  const handleClear = () => {
    setText('');
    setCursorPosition(0);
  };

  // Build highlighted text segments when speaking
  const renderHighlightedText = () => {
    if (!spokenRange || !text) {
      return <Text style={[styles.highlightText, { fontSize, lineHeight }, isTextRTL && styles.textInputRTL, speakButtonPadding > 0 && { paddingBottom: speakButtonPadding }]}>{text}</Text>;
    }

    // Clamp to the text: a range that runs past the end (or carries a non-finite
    // offset from a malformed progress event) would otherwise slice with NaN and
    // emit the whole string in both the `before` and `after` segments, rendering
    // the text twice.
    const { location, length } = spokenRange;
    if (!Number.isFinite(location) || !Number.isFinite(length)) {
      return <Text style={[styles.highlightText, { fontSize, lineHeight }, isTextRTL && styles.textInputRTL, speakButtonPadding > 0 && { paddingBottom: speakButtonPadding }]}>{text}</Text>;
    }
    const start = Math.max(0, Math.min(location, text.length));
    const end = Math.max(start, Math.min(start + length, text.length));
    const before = text.substring(0, start);
    const highlighted = text.substring(start, end);
    const after = text.substring(end);

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
          isPhoneLandscape && { paddingTop: 4 },
          isTextRTL && styles.textInputRTL,
          isSpeaking && spokenText === text && styles.hiddenTextInput,
          speakButtonPadding > 0 && { paddingBottom: speakButtonPadding },
        ]}
        value={text}
        onChangeText={(newText) => {
          console.log('⌨️ External keyboard input detected:', newText);
          setText(newText);
        }}
        onSelectionChange={(e) => {
          const {start, end} = e.nativeEvent.selection;
          // Release the controlled `selection` prop once the caret is confirmed to
          // be where the prop says. Doing it here rather than on a timer means a
          // programmatic move stays controlled until it actually lands, while a
          // user tap or drag — which reports a different position — releases
          // immediately so a stale value can never snap the caret back.
          if (selection !== undefined && selection.start === start && selection.end === end) {
            setSelection(undefined);
          }
          // Report only — never push a collapsed selection back into the TextInput,
          // which would also wipe out a range the user is dragging out by hand.
          // Track the caret from `end`, which is where it sits after a drag.
          setCursorPosition(end, false);
          hasUserSelectionRef.current = start !== end;
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
      {isSpeaking && text.length > 0 && spokenText === text && (
        <ScrollView style={styles.highlightOverlay} pointerEvents="none">
          {renderHighlightedText()}
        </ScrollView>
      )}
      {/* Delete button - top-start, Save button - top-end */}
      <TouchableOpacity
        style={[styles.topButton, styles.bottomButton, styles.deleteButton, isRTL ? { right: 8 } : { left: 8 }, !text.length && styles.topButtonDisabled]}
        onPress={handleClear}
        activeOpacity={0.7}
        disabled={!text.length}>
        <MyIcon info={{ name: 'trash-outline', type: 'Ionicons', color: text.length ? '#E53935' : colors.textLight, size: 22 }} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.topButton, styles.saveButton, isRTL ? { left: 8 } : { right: 8 }, !text.length && styles.topButtonDisabled]}
        onPress={onSave}
        activeOpacity={0.7}
        disabled={!text.length}>
        <MyIcon info={{ name: 'save-outline', type: 'Ionicons', color: text.length ? colors.primary : colors.textLight, size: 32 }} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.topButton, styles.browseButton, isRTL ? { left: 8 } : { right: 8 }]}
        onPress={onBrowse}
        activeOpacity={0.7}>
        <MyIcon info={{ name: 'list-sharp', type: 'Ionicons', color: colors.primary, size: 32 }} />
      </TouchableOpacity>
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
    paddingLeft: 64,
    paddingRight: 64,
  },
  textInputRTL: {
    textAlign: 'right',
  },
  topButton: {
    position: 'absolute',
    top: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomButton: {
    top: undefined,
    bottom: 6,
  },
  topButtonDisabled: {
    opacity: 0.4,
  },
  deleteButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  saveButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  browseButton: {
    top: 68,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  hiddenTextInput: {
    // Hide the input's own text so only the highlight overlay is visible.
    // Android keeps painting the text despite a transparent color, leaving it
    // showing through under the overlay — so make the whole input invisible there.
    // opacity is not used on iOS because it would also hide the caret, which stays
    // visible while speaking.
    ...Platform.select({
      android: { opacity: 0 },
      default: { color: 'transparent' },
    }),
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
    // Match the TextInput's paddingTop so the overlay sits exactly on top of the
    // text it replaces. iOS needs +5 because a UITextView insets its own text
    // relative to a plain Text; Android lays both out the same, and the extra
    // offset there is what made the overlay appear ~20px below the input's text.
    paddingTop: Platform.OS === 'ios' ? 13 : 8,
    paddingLeft: 64,
    paddingRight: 64,
    // Android adds extra leading above the first line of a Text but not inside a
    // TextInput, which would push the overlay down even with matching padding.
    ...Platform.select({ android: { includeFontPadding: false }, default: {} }),
  },
  highlightedWord: {
    backgroundColor: '#FFD700',
    color: '#000000',
    borderRadius: 4,
  },
});

export default TextDisplayArea;