import React from 'react';
import {View, StyleSheet, TouchableOpacity, Text} from 'react-native';
import {colors, sizes} from '../../constants';
import {useLocalization} from '../../context/LocalizationContext';

interface ActionBarProps {
  onSpeak: () => void;
  onClear: () => void;
  onSave: () => void;
  onBrowse: () => void;
  isSpeaking: boolean;
  hasText: boolean;
  currentLanguage?: 'en' | 'he';
  buttonHeight?: number; // Optional responsive height
}

const ActionBar: React.FC<ActionBarProps> = ({
  onSpeak,
  onClear,
  onSave,
  onBrowse,
  isSpeaking,
  hasText,
  currentLanguage = 'en',
  buttonHeight = sizes.actionButton, // Default to constant if not provided
}) => {
  const {strings, isRTL} = useLocalization();

  // Calculate font size based on button height (scale proportionally)
  const scaleFactor = buttonHeight / sizes.actionButton;
  const buttonFontSize = Math.max(16, sizes.fontSize.medium * scaleFactor);

  // Render buttons in order, then reverse container for LTR
  return (
    <View style={[styles.container, !isRTL && styles.containerReversed]}>
      {/* Speak Button - Green, More Prominent */}
      <SpeakButton
        onSpeak={onSpeak}
        isSpeaking={isSpeaking}
        hasText={hasText}
        buttonHeight={buttonHeight}
      />

      {/* Clear Button - Red */}
      <TouchableOpacity
        style={[
          styles.button,
          styles.clearButton,
          {height: buttonHeight},
          !hasText && styles.buttonDisabled,
        ]}
        onPress={onClear}
        disabled={!hasText}
        activeOpacity={0.7}>
        <Text style={[styles.buttonText, {fontSize: buttonFontSize}]}>{strings.clear}</Text>
      </TouchableOpacity>

      {/* Save Button - Amber */}
      <TouchableOpacity
        style={[
          styles.button,
          styles.saveButton,
          {height: buttonHeight},
          !hasText && styles.buttonDisabled,
        ]}
        onPress={onSave}
        disabled={!hasText}
        activeOpacity={0.7}>
        <Text style={[styles.buttonText, {fontSize: buttonFontSize}]}>{strings.save}</Text>
      </TouchableOpacity>

      {/* Browse Button - Purple */}
      <TouchableOpacity
        style={[styles.button, styles.browseButton, {height: buttonHeight}]}
        onPress={onBrowse}
        activeOpacity={0.7}>
        <Text style={[styles.buttonText, {fontSize: buttonFontSize}]}>{strings.browse}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: sizes.spacing.md,
    paddingVertical: sizes.spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: sizes.spacing.sm,
  },
  containerReversed: {
    flexDirection: 'row-reverse',
  },
  button: {
    flex: 1,
    borderRadius: sizes.borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clearButton: {
    backgroundColor: colors.clear,
  },
  saveButton: {
    backgroundColor: colors.save,
  },
  browseButton: {
    backgroundColor: colors.browse,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ActionBar;