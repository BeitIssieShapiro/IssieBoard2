import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {useTTS} from '../../context/TTSContext';
import {useLocalization} from '../../context/LocalizationContext';
import {colors, sizes} from '../../constants';
import TTS from '../../services/TextToSpeech';

interface Voice {
  id: string;
  name: string;
  language: string;
}

export interface VoiceSettingsPanelProps {
  englishVoice?: string;
  hebrewVoice?: string;
  onVoiceChange: (language: 'en' | 'he', voiceId: string) => void;
}

const VoiceSettingsPanel: React.FC<VoiceSettingsPanelProps> = ({
  englishVoice,
  hebrewVoice,
  onVoiceChange,
}) => {
  const {speak, settings, updateSettings, getAvailableVoices} = useTTS();
  const {strings} = useLocalization();

  const [englishVoices, setEnglishVoices] = useState<Voice[]>([]);
  const [hebrewVoices, setHebrewVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [hebrewVoicesExpanded, setHebrewVoicesExpanded] = useState(false);
  const [englishVoicesExpanded, setEnglishVoicesExpanded] = useState(false);

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    setLoading(true);
    try {
      const availableVoices = await getAvailableVoices();

      const enVoices = availableVoices.filter((voice: Voice) =>
        voice.language.startsWith('en'),
      );
      const heVoices = availableVoices.filter((voice: Voice) =>
        voice.language.startsWith('he'),
      );

      setEnglishVoices(enVoices);
      setHebrewVoices(heVoices);
    } catch (error) {
      console.error('Failed to load voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestVoice = useCallback(async () => {
    try {
      const hasHebrew = settings.language === 'he-IL';
      const testText = hasHebrew ? '\u05E9\u05DC\u05D5\u05DD, \u05D6\u05D4 \u05DE\u05D1\u05D7\u05DF' : 'Hello, this is a test';
      await speak(testText);
    } catch (error) {
      console.error('Failed to test voice:', error);
    }
  }, [speak, settings.language]);

  const handleRateChange = useCallback(
    async (rate: number) => {
      await updateSettings({rate});
    },
    [updateSettings],
  );

  const handlePitchChange = useCallback(
    async (pitch: number) => {
      await updateSettings({pitch});
    },
    [updateSettings],
  );

  const handleVoiceSelect = useCallback(
    (language: 'en' | 'he', voiceId: string) => {
      onVoiceChange(language, voiceId);
    },
    [onVoiceChange],
  );

  const handleTestSingleVoice = useCallback(async (voice: Voice) => {
    try {
      const testText = voice.language.startsWith('he') ? '\u05E9\u05DC\u05D5\u05DD' : 'Hello';
      await TTS.setVoice(voice.id);
      await TTS.speak(testText);
    } catch (error) {
      console.error('Failed to test voice:', error);
    }
  }, []);

  const rateOptions = [
    {label: strings.settings.slow, value: 0.3},
    {label: strings.settings.normal, value: 0.5},
    {label: strings.settings.fast, value: 0.7},
  ];

  const pitchOptions = [
    {label: strings.settings.low, value: 0.8},
    {label: strings.settings.normal, value: 1.0},
    {label: strings.settings.high, value: 1.2},
  ];

  const renderVoiceAccordion = (
    title: string,
    voices: Voice[],
    selectedVoiceId: string | undefined,
    language: 'en' | 'he',
    expanded: boolean,
    onToggle: () => void,
  ) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={onToggle}
        activeOpacity={0.7}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.accordionIcon}>{expanded ? '\u25BC' : '\u25B6'}</Text>
      </TouchableOpacity>

      {selectedVoiceId && (
        <View style={styles.accordionCurrentValue}>
          <Text style={styles.currentValueText}>
            {strings.settingsModal.current}{' '}
            {voices.find(v => v.id === selectedVoiceId)?.name ||
              strings.settingsModal.none}
          </Text>
        </View>
      )}

      {expanded &&
        (loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <View style={styles.voiceList}>
            {voices.map(voice => (
              <View
                key={voice.id}
                style={[
                  styles.voiceItem,
                  selectedVoiceId === voice.id && styles.voiceItemSelected,
                ]}>
                <TouchableOpacity
                  style={styles.voiceButton}
                  onPress={() => handleVoiceSelect(language, voice.id)}>
                  <Text
                    style={[
                      styles.voiceText,
                      selectedVoiceId === voice.id && styles.voiceTextSelected,
                    ]}>
                    {voice.name}
                  </Text>
                  <Text style={styles.voiceLanguage}>{voice.language}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.testVoiceButton}
                  onPress={() => handleTestSingleVoice(voice)}
                  activeOpacity={0.7}>
                  <Text style={styles.testVoiceButtonText}>Test</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Test Voice Button */}
      <TouchableOpacity
        style={styles.testButton}
        onPress={handleTestVoice}
        activeOpacity={0.7}>
        <Text style={styles.testButtonText}>Test Voice</Text>
      </TouchableOpacity>

      {/* Speech Speed */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{strings.settings.speechSpeed}</Text>
        <View style={styles.optionsRow}>
          {rateOptions.map(option => (
            <TouchableOpacity
              key={option.label}
              style={[
                styles.optionButton,
                settings.rate === option.value && styles.optionButtonActive,
              ]}
              onPress={() => handleRateChange(option.value)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.optionText,
                  settings.rate === option.value && styles.optionTextActive,
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Voice Pitch */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{strings.settings.voicePitch}</Text>
        <View style={styles.optionsRow}>
          {pitchOptions.map(option => (
            <TouchableOpacity
              key={option.label}
              style={[
                styles.optionButton,
                settings.pitch === option.value && styles.optionButtonActive,
              ]}
              onPress={() => handlePitchChange(option.value)}
              activeOpacity={0.7}>
              <Text
                style={[
                  styles.optionText,
                  settings.pitch === option.value && styles.optionTextActive,
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Hebrew Voice Accordion */}
      {renderVoiceAccordion(
        strings.settingsModal.hebrewVoice,
        hebrewVoices,
        hebrewVoice,
        'he',
        hebrewVoicesExpanded,
        () => setHebrewVoicesExpanded(!hebrewVoicesExpanded),
      )}

      {/* English Voice Accordion */}
      {renderVoiceAccordion(
        strings.settingsModal.englishVoice,
        englishVoices,
        englishVoice,
        'en',
        englishVoicesExpanded,
        () => setEnglishVoicesExpanded(!englishVoicesExpanded),
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: sizes.spacing.md,
    gap: sizes.spacing.md,
  },
  testButton: {
    backgroundColor: colors.primary,
    borderRadius: sizes.borderRadius.medium,
    paddingVertical: sizes.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  testButtonText: {
    fontSize: sizes.fontSize.large,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: sizes.borderRadius.large,
    padding: sizes.spacing.lg,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: sizes.fontSize.large,
    fontWeight: '600',
    color: colors.text,
    marginBottom: sizes.spacing.md,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: sizes.spacing.sm,
  },
  optionButton: {
    flex: 1,
    height: sizes.touchTarget.large,
    backgroundColor: colors.surface,
    borderRadius: sizes.borderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  optionText: {
    fontSize: sizes.fontSize.medium,
    color: colors.text,
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accordionIcon: {
    fontSize: sizes.fontSize.large,
    color: colors.text,
  },
  accordionCurrentValue: {
    marginBottom: sizes.spacing.md,
  },
  currentValueText: {
    fontSize: sizes.fontSize.medium,
    color: colors.primary,
    fontWeight: '600',
  },
  voiceList: {
    gap: sizes.spacing.sm,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: sizes.borderRadius.medium,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  voiceItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  voiceButton: {
    flex: 1,
    padding: sizes.spacing.md,
  },
  voiceText: {
    fontSize: sizes.fontSize.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: sizes.spacing.xs,
  },
  voiceTextSelected: {
    color: colors.primary,
  },
  voiceLanguage: {
    fontSize: sizes.fontSize.small,
    color: colors.textLight,
  },
  testVoiceButton: {
    paddingHorizontal: sizes.spacing.lg,
    paddingVertical: sizes.spacing.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  testVoiceButtonText: {
    fontSize: sizes.fontSize.medium,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default VoiceSettingsPanel;
