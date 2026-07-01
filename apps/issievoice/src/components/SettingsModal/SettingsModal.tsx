import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {useTTS} from '../../context/TTSContext';
import {colors, sizes} from '../../constants';
import TTS from '../../services/TextToSpeech';
import {useLocalization} from '../../context/LocalizationContext';

interface Voice {
  id: string;
  name: string;
  language: string;
}

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  languageMode: 'en-only' | 'he-only' | 'detect';
  onLanguageModeChange: (mode: 'en-only' | 'he-only' | 'detect') => void;
  englishVoice?: string;
  hebrewVoice?: string;
  onVoiceChange: (language: 'en' | 'he', voiceId: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  languageMode,
  onLanguageModeChange,
  englishVoice,
  hebrewVoice,
  onVoiceChange,
}) => {
  const {getAvailableVoices} = useTTS();
  const {strings} = useLocalization();
  const [englishVoices, setEnglishVoices] = useState<Voice[]>([]);
  const [hebrewVoices, setHebrewVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [hebrewVoicesExpanded, setHebrewVoicesExpanded] = useState(false);
  const [englishVoicesExpanded, setEnglishVoicesExpanded] = useState(false);

  useEffect(() => {
    if (visible) {
      loadVoices();
    }
  }, [visible]);

  const loadVoices = async () => {
    setLoading(true);
    try {
      const availableVoices = await getAvailableVoices();
      console.log('Available voices:', availableVoices);

      // Separate English and Hebrew voices
      const enVoices = availableVoices.filter((voice: Voice) =>
        voice.language.startsWith('en')
      );
      const heVoices = availableVoices.filter((voice: Voice) =>
        voice.language.startsWith('he')
      );

      console.log('English voices:', enVoices);
      console.log('Hebrew voices:', heVoices);

      setEnglishVoices(enVoices);
      setHebrewVoices(heVoices);
    } catch (error) {
      console.error('Failed to load voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceSelect = async (language: 'en' | 'he', voiceId: string) => {
    try {
      onVoiceChange(language, voiceId);
    } catch (error) {
      console.error('Failed to set voice:', error);
    }
  };

  const handleLanguageModeSelect = (mode: 'en-only' | 'he-only' | 'detect') => {
    onLanguageModeChange(mode);
  };

  const handleTestVoice = async (voice: Voice) => {
    try {
      // Determine test text based on voice language
      const testText = voice.language.startsWith('he') ? 'שלום' : 'Hello';

      console.log(`🔊 Testing voice: ${voice.name} with text: "${testText}"`);

      // Temporarily set this voice and speak
      await TTS.setVoice(voice.id);
      await TTS.speak(testText);
    } catch (error) {
      console.error('Failed to test voice:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{strings.settingsModal.title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Language Mode Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{strings.settingsModal.languageMode}</Text>
              <View style={styles.optionGroup}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    languageMode === 'en-only' && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleLanguageModeSelect('en-only')}>
                  <Text
                    style={[
                      styles.optionText,
                      languageMode === 'en-only' && styles.optionTextSelected,
                    ]}>
                    {strings.settingsModal.englishOnly}
                  </Text>
                  <Text style={styles.optionDescription}>
                    {strings.settingsModal.englishOnlyDesc}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    languageMode === 'he-only' && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleLanguageModeSelect('he-only')}>
                  <Text
                    style={[
                      styles.optionText,
                      languageMode === 'he-only' && styles.optionTextSelected,
                    ]}>
                    {strings.settingsModal.hebrewOnly}
                  </Text>
                  <Text style={styles.optionDescription}>
                    {strings.settingsModal.hebrewOnlyDesc}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    languageMode === 'detect' && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleLanguageModeSelect('detect')}>
                  <Text
                    style={[
                      styles.optionText,
                      languageMode === 'detect' && styles.optionTextSelected,
                    ]}>
                    {strings.settingsModal.autoDetect}
                  </Text>
                  <Text style={styles.optionDescription}>
                    {strings.settingsModal.autoDetectDesc}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Hebrew Voice Section - Accordion */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setHebrewVoicesExpanded(!hebrewVoicesExpanded)}
                activeOpacity={0.7}>
                <Text style={styles.sectionTitle}>{strings.settingsModal.hebrewVoice}</Text>
                <Text style={styles.accordionIcon}>
                  {hebrewVoicesExpanded ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {hebrewVoice && (
                <View style={styles.accordionCurrentValue}>
                  <Text style={styles.currentValueText}>
                    {strings.settingsModal.current} {hebrewVoices.find(v => v.id === hebrewVoice)?.name || strings.settingsModal.none}
                  </Text>
                </View>
              )}

              {hebrewVoicesExpanded && (
                loading ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <View style={styles.voiceList}>
                    {hebrewVoices.map((voice) => (
                      <View
                        key={voice.id}
                        style={[
                          styles.voiceItem,
                          hebrewVoice === voice.id && styles.voiceItemSelected,
                        ]}>
                        <TouchableOpacity
                          style={styles.voiceButton}
                          onPress={() => handleVoiceSelect('he', voice.id)}>
                          <Text
                            style={[
                              styles.voiceText,
                              hebrewVoice === voice.id && styles.voiceTextSelected,
                            ]}>
                            {voice.name}
                          </Text>
                          <Text style={styles.voiceLanguage}>{voice.language}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.testButton}
                          onPress={() => handleTestVoice(voice)}
                          activeOpacity={0.7}>
                          <Text style={styles.testButtonText}>🔊</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )
              )}
            </View>

            {/* English Voice Section - Accordion */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setEnglishVoicesExpanded(!englishVoicesExpanded)}
                activeOpacity={0.7}>
                <Text style={styles.sectionTitle}>{strings.settingsModal.englishVoice}</Text>
                <Text style={styles.accordionIcon}>
                  {englishVoicesExpanded ? '▼' : '▶'}
                </Text>
              </TouchableOpacity>

              {englishVoice && (
                <View style={styles.accordionCurrentValue}>
                  <Text style={styles.currentValueText}>
                    {strings.settingsModal.current} {englishVoices.find(v => v.id === englishVoice)?.name || strings.settingsModal.none}
                  </Text>
                </View>
              )}

              {englishVoicesExpanded && (
                loading ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <View style={styles.voiceList}>
                    {englishVoices.map((voice) => (
                      <View
                        key={voice.id}
                        style={[
                          styles.voiceItem,
                          englishVoice === voice.id && styles.voiceItemSelected,
                        ]}>
                        <TouchableOpacity
                          style={styles.voiceButton}
                          onPress={() => handleVoiceSelect('en', voice.id)}>
                          <Text
                            style={[
                              styles.voiceText,
                              englishVoice === voice.id && styles.voiceTextSelected,
                            ]}>
                            {voice.name}
                          </Text>
                          <Text style={styles.voiceLanguage}>{voice.language}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.testButton}
                          onPress={() => handleTestVoice(voice)}
                          activeOpacity={0.7}>
                          <Text style={styles.testButtonText}>🔊</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    height: '80%',
    backgroundColor: colors.surface,
    borderRadius: sizes.borderRadius.large,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: sizes.spacing.lg,
    backgroundColor: colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: sizes.fontSize.xlarge,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: sizes.fontSize.xlarge,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: sizes.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: sizes.fontSize.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: sizes.spacing.md,
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
  optionGroup: {
    gap: sizes.spacing.sm,
  },
  optionButton: {
    padding: sizes.spacing.md,
    backgroundColor: colors.surfaceDark,
    borderRadius: sizes.borderRadius.medium,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  optionText: {
    fontSize: sizes.fontSize.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: sizes.spacing.xs,
  },
  optionTextSelected: {
    color: colors.primary,
  },
  optionDescription: {
    fontSize: sizes.fontSize.small,
    color: colors.textLight,
  },
  voiceList: {
    gap: sizes.spacing.sm,
  },
  voiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
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
  testButton: {
    paddingHorizontal: sizes.spacing.lg,
    paddingVertical: sizes.spacing.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  testButtonText: {
    fontSize: sizes.fontSize.medium,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SettingsModal;
