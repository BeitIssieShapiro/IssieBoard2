import React from 'react';
import { Text, TouchableOpacity, Alert, StyleSheet, Platform } from 'react-native';
import { useLocalization } from '../localization';

interface SetupStatusStripProps {
  isAdded: boolean | null;
  languageName: string;
}

export const SetupStatusStrip: React.FC<SetupStatusStripProps> = ({ isAdded, languageName }) => {
  const { strings } = useLocalization();

  // Only show when keyboard is definitively NOT added
  if (isAdded !== false) {
    return null;
  }

  const stripText = strings.setup.keyboardNotAdded.replace('{{language}}', languageName);

  const showInstructions = () => {
    const steps = Platform.OS === 'android'
      ? [
          strings.setup.androidSetupStep1,
          strings.setup.androidSetupStep2,
          strings.setup.androidSetupStep3,
          strings.setup.androidSetupStep4,
        ]
      : [
          strings.setup.setupStep1,
          strings.setup.setupStep2,
          strings.setup.setupStep3,
          strings.setup.setupStep4,
          strings.setup.setupStep5,
          strings.setup.setupStep6,
        ];

    Alert.alert(strings.setup.setupInstructionsTitle, steps.join('\n'));
  };

  return (
    <TouchableOpacity
      style={styles.strip}
      onPress={showInstructions}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={stripText}
      accessibilityHint={strings.setup.tapForInstructions}
    >
      <Text allowFontScaling={false} style={styles.icon}>&#x26A0;&#xFE0F;</Text>
      <Text allowFontScaling={false} style={styles.text}>
        {stripText}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#FFEEBA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#856404',
  },
});
