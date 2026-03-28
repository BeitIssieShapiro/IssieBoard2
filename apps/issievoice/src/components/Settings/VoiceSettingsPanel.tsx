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
import {ButtonGroupRow} from '../../../../../src/components/shared/ButtonGroupRow';
import {subtleShadow} from '../../../../../src/styles/shadows';

interface Voice {
  id: string;
  name: string;
  language: string;
}

export interface VoiceSettingsPanelProps {
  englishVoice?: string;
  hebrewVoice?: string;
  arabicVoice?: string;
  onVoiceChange: (language: 'en' | 'he' | 'ar', voiceId: string) => void;
}

const TEST_TEXTS: Record<string, string> = {
  he: '\u05E9\u05DC\u05D5\u05DD',
  ar: '\u0645\u0631\u062D\u0628\u0627',
  en: 'Hello',
};

const getTestText = (langPrefix: string) => {
  if (langPrefix.startsWith('he')) return TEST_TEXTS.he;
  if (langPrefix.startsWith('ar')) return TEST_TEXTS.ar;
  return TEST_TEXTS.en;
};

const VoiceSettingsPanel: React.FC<VoiceSettingsPanelProps> = ({
  englishVoice,
  hebrewVoice,
  arabicVoice,
  onVoiceChange,
}) => {
  const {settings, updateSettings, getAvailableVoices} = useTTS();
  const {strings, isRTL} = useLocalization();

  const [englishVoices, setEnglishVoices] = useState<Voice[]>([]);
  const [hebrewVoices, setHebrewVoices] = useState<Voice[]>([]);
  const [arabicVoices, setArabicVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPicker, setExpandedPicker] = useState<'en' | 'he' | 'ar' | null>(null);

  useEffect(() => {
    loadVoices();
  }, []);

  const loadVoices = async () => {
    setLoading(true);
    try {
      const availableVoices = await getAvailableVoices();
      setEnglishVoices(availableVoices.filter((v: Voice) => v.language.startsWith('en')));
      setHebrewVoices(availableVoices.filter((v: Voice) => v.language.startsWith('he')));
      setArabicVoices(availableVoices.filter((v: Voice) => v.language.startsWith('ar')));
    } catch (error) {
      console.error('Failed to load voices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRateChange = useCallback(
    async (id: string) => {
      const rateMap: Record<string, number> = {slow: 0.3, normal: 0.5, fast: 0.7};
      await updateSettings({rate: rateMap[id]});
    },
    [updateSettings],
  );

  const handlePitchChange = useCallback(
    async (id: string) => {
      const pitchMap: Record<string, number> = {low: 0.8, normal: 1.0, high: 1.2};
      await updateSettings({pitch: pitchMap[id]});
    },
    [updateSettings],
  );

  const handleVoiceSelect = useCallback(
    (language: 'en' | 'he' | 'ar', voiceId: string) => {
      onVoiceChange(language, voiceId);
      setExpandedPicker(null);
    },
    [onVoiceChange],
  );

  const handleTestVoice = useCallback(async (voiceId: string, langPrefix: string) => {
    try {
      await TTS.setVoice(voiceId);
      await TTS.speak(getTestText(langPrefix));
    } catch (error) {
      console.error('Failed to test voice:', error);
    }
  }, []);

  const currentRateId =
    settings.rate <= 0.3 ? 'slow' : settings.rate >= 0.7 ? 'fast' : 'normal';
  const currentPitchId =
    settings.pitch <= 0.8 ? 'low' : settings.pitch >= 1.2 ? 'high' : 'normal';

  const rateOptions = [
    {id: 'slow', label: strings.settings.slow},
    {id: 'normal', label: strings.settings.normal},
    {id: 'fast', label: strings.settings.fast},
  ];

  const pitchOptions = [
    {id: 'low', label: strings.settings.low},
    {id: 'normal', label: strings.settings.normal},
    {id: 'high', label: strings.settings.high},
  ];

  const renderVoicePicker = (
    label: string,
    voices: Voice[],
    selectedVoiceId: string | undefined,
    language: 'en' | 'he' | 'ar',
  ) => {
    if (voices.length === 0 && !loading) return null;

    const isExpanded = expandedPicker === language;
    const selectedVoice = voices.find(v => v.id === selectedVoiceId);

    return (
      <View style={styles.pickerRow}>
        {/* Label */}
        <Text style={[styles.pickerLabel, isRTL && { textAlign: 'right' }]}>{label}</Text>

        {/* Current voice + test + dropdown toggle */}
        <View style={[styles.pickerControl, isRTL && { flexDirection: 'row-reverse' }]}>
          <TouchableOpacity
            style={[styles.pickerDropdown, isRTL && { flexDirection: 'row-reverse' }]}
            onPress={() => setExpandedPicker(isExpanded ? null : language)}
            activeOpacity={0.7}>
            <Text style={[styles.pickerValue, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
              {selectedVoice?.name || strings.settingsModal.none}
            </Text>
            <Text style={[styles.pickerArrow, isRTL && { marginLeft: 0, marginRight: 8 }]}>{isExpanded ? '\u25B2' : '\u25BC'}</Text>
          </TouchableOpacity>

          {selectedVoiceId ? (
            <TouchableOpacity
              style={styles.testCurrentButton}
              onPress={() => handleTestVoice(selectedVoiceId, language)}
              activeOpacity={0.7}>
              <Text style={styles.testCurrentButtonText}>{strings.settings.test}</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.testCurrentButton, styles.testCurrentButtonDisabled]}>
              <Text style={[styles.testCurrentButtonText, styles.testCurrentButtonTextDisabled]}>{strings.settings.test}</Text>
            </View>
          )}
        </View>

        {/* Expanded dropdown list */}
        {isExpanded && (
          loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{marginTop: 8}} />
          ) : (
            <View style={styles.dropdownList}>
              {voices.map(voice => {
                const isSelected = selectedVoiceId === voice.id;
                return (
                  <View
                    key={voice.id}
                    style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected, isRTL && { flexDirection: 'row-reverse' }]}>
                    <TouchableOpacity
                      style={styles.dropdownItemInfo}
                      onPress={() => handleVoiceSelect(language, voice.id)}>
                      <Text style={[styles.dropdownItemName, isSelected && styles.dropdownItemNameSelected, isRTL && { textAlign: 'right' }]}>
                        {voice.name}
                      </Text>
                      <Text style={[styles.dropdownItemLang, isRTL && { textAlign: 'right' }]}>{voice.language}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dropdownTestButton}
                      onPress={() => handleTestVoice(voice.id, voice.language)}
                      activeOpacity={0.7}>
                      <Text style={styles.dropdownTestButtonText}>{strings.settings.test}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Speech Speed */}
      <ButtonGroupRow
        isRTL={isRTL}
        title={strings.settings.speechSpeed}
        options={rateOptions}
        selectedId={currentRateId}
        onSelect={handleRateChange}
      />

      {/* Voice Pitch */}
      <ButtonGroupRow
        isRTL={isRTL}
        title={strings.settings.voicePitch}
        options={pitchOptions}
        selectedId={currentPitchId}
        onSelect={handlePitchChange}
      />

      {/* Voice Selection Section */}
      <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{strings.settings.tabs.voice}</Text>

      {renderVoicePicker(
        strings.settingsModal.hebrewVoice,
        hebrewVoices,
        hebrewVoice,
        'he',
      )}

      {renderVoicePicker(
        strings.settingsModal.englishVoice,
        englishVoices,
        englishVoice,
        'en',
      )}

      {renderVoicePicker(
        strings.settingsModal.arabicVoice,
        arabicVoices,
        arabicVoice,
        'ar',
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },

  // Voice picker row
  pickerRow: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  pickerControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...subtleShadow,
  },
  pickerValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  pickerArrow: {
    fontSize: 10,
    color: '#6B7280',
    marginLeft: 8,
  },
  testCurrentButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  testCurrentButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  testCurrentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  testCurrentButtonTextDisabled: {
    color: '#9CA3AF',
  },

  // Dropdown list
  dropdownList: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
    ...subtleShadow,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  dropdownItemSelected: {
    backgroundColor: colors.primary + '15',
  },
  dropdownItemInfo: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  dropdownItemNameSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  dropdownItemLang: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  dropdownTestButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownTestButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});

export default VoiceSettingsPanel;
