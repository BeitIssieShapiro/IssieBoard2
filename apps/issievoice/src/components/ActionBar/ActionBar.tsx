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
}

const ActionBar: React.FC<ActionBarProps> = ({
  onSpeak,
  onClear,
  onSave,
  onBrowse,
  isSpeaking,
  hasText,
  currentLanguage = 'en',
}) => {
  const {strings, isRTL} = useLocalization();

  // Render buttons in order, then reverse container for LTR
  return (
    <View style={[styles.container, !isRTL && styles.containerReversed]}>
      {/* Speak Button - Green, More Prominent */}
      <TouchableOpacity
        style={[
          styles.button,
          styles.speakButton,
          (!hasText || isSpeaking) && styles.buttonDisabled,
        ]}
        onPress={onSpeak}
        disabled={!hasText || isSpeaking}
        activeOpacity={0.7}>
        <Text style={styles.speakButtonText}>
          {isSpeaking ? strings.speaking : strings.speak}
        </Text>
      </TouchableOpacity>

      {/* Clear Button - Red */}
      <TouchableOpacity
        style={[
          styles.button,
          styles.clearButton,
          !hasText && styles.buttonDisabled,
        ]}
        onPress={onClear}
        disabled={!hasText}
        activeOpacity={0.7}>
        <Text style={styles.buttonText}>{strings.clear}</Text>
      </TouchableOpacity>

      {/* Save Button - Amber */}
      <TouchableOpacity
        style={[
          styles.button,
          styles.saveButton,
          !hasText && styles.buttonDisabled,
        ]}
        onPress={onSave}
        disabled={!hasText}
        activeOpacity={0.7}>
        <Text style={styles.buttonText}>{strings.save}</Text>
      </TouchableOpacity>

      {/* Browse Button - Purple */}
      <TouchableOpacity
        style={[styles.button, styles.browseButton]}
        onPress={onBrowse}
        activeOpacity={0.7}>
        <Text style={styles.buttonText}>{strings.browse}</Text>
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
    height: sizes.actionButton,
    borderRadius: sizes.borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  speakButton: {
    flex: 2,  // Double width of other buttons
    backgroundColor: colors.speak,
    shadowColor: colors.speak,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  speakButtonText: {
    color: '#FFFFFF',
    fontSize: sizes.fontSize.large,  // Larger font
    fontWeight: 'bold',
    textAlign: 'center',
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
    fontSize: sizes.fontSize.medium,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ActionBar;