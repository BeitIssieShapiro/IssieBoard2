import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import { useCalcTTS, MathLevel } from '../context/CalcTTSContext';
import { ButtonGroupRow } from '../../../../src/components/shared/ButtonGroupRow';
import TTS from '../../../issievoice/src/services/TextToSpeech';
import { subtleShadow } from '../../../../src/styles/shadows';
import { useLocalization } from '../../../issievoice/src/context/LocalizationContext';
import { getLanguageDisplayName, languageMatchesQuery } from '../utils/languageNames';

interface Voice {
  id: string;
  name: string;
  language: string;
}

const CalcVoiceSettingsPanel: React.FC<{ onSettingsChange?: () => void }> = ({ onSettingsChange }) => {
  const { readoutMode, rate, pitch, voiceId, decimalDigits, mathLevel, setReadoutMode, setRate, setPitch, setVoice, setDecimalDigits, setMathLevel } = useCalcTTS();
  const { strings, isRTL, language: uiLang } = useLocalization();
  const s = strings.settings;
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [langQuery, setLangQuery] = useState('');

  useEffect(() => {
    TTS.getAvailableVoices().then(v => {
      setVoices(v);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleRateChange = useCallback((id: string) => {
    const map: Record<string, number> = { slow: 0.3, normal: 0.5, fast: 0.7 };
    setRate(map[id]); onSettingsChange?.();
  }, [setRate, onSettingsChange]);

  const handlePitchChange = useCallback((id: string) => {
    const map: Record<string, number> = { low: 0.8, normal: 1.0, high: 1.2 };
    setPitch(map[id]); onSettingsChange?.();
  }, [setPitch, onSettingsChange]);

  const handleVoiceSelect = useCallback((voice: Voice) => {
    setVoice(voice.id, voice.language);
    setExpanded(false);
    setLangQuery('');
    onSettingsChange?.();
  }, [setVoice, onSettingsChange]);

  const toggleExpanded = useCallback(() => {
    setExpanded(e => {
      if (e) setLangQuery(''); // reset filter when collapsing
      return !e;
    });
  }, []);

  const handleTest = useCallback(async (voice: Voice) => {
    try {
      await TTS.setLanguage(voice.language);
      await TTS.setVoice(voice.id);
      await TTS.speak('Hello');
    } catch {}
  }, []);

  const readoutOptions = [
    { id: 'off', label: s.calcReadoutOff },
    { id: 'every-digit', label: s.calcReadoutEveryDigit },
    { id: 'every-number', label: s.calcReadoutEveryNumber },
    { id: 'both', label: s.calcReadoutBoth },
  ];

  const mathLevelOptions = [
    { id: 'young', label: s.calcTerminologyYoung },
    { id: 'standard', label: s.calcTerminologyStandard },
  ];

  const rateOptions = [
    { id: 'slow', label: s.slow },
    { id: 'normal', label: s.normal },
    { id: 'fast', label: s.fast },
  ];

  const pitchOptions = [
    { id: 'low', label: s.low },
    { id: 'normal', label: s.normal },
    { id: 'high', label: s.high },
  ];

  const decimalOptions = [
    { id: '0', label: '0' },
    { id: '1', label: '1' },
    { id: '2', label: '2' },
    { id: '3', label: '3' },
    { id: '4', label: '4' },
    { id: '-1', label: s.calcDecimalAll },
  ];

  const currentRateId = rate <= 0.3 ? 'slow' : rate >= 0.7 ? 'fast' : 'normal';
  const currentPitchId = pitch <= 0.8 ? 'low' : pitch >= 1.2 ? 'high' : 'normal';
  const selectedVoice = voices.find(v => v.id === voiceId);

  const groupedVoices = useMemo(() => {
    const groups: { lang: string; voices: Voice[] }[] = [];
    voices.forEach(v => {
      const lang = v.language.split('-')[0];
      const group = groups.find(g => g.lang === lang);
      if (group) group.voices.push(v);
      else groups.push({ lang, voices: [v] });
    });
    return groups.filter(g => languageMatchesQuery(g.lang, langQuery));
  }, [voices, langQuery]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ButtonGroupRow
        title={s.calcReadout}
        options={readoutOptions}
        selectedId={readoutMode}
        onSelect={id => { setReadoutMode(id as any); onSettingsChange?.(); }}
        isRTL={isRTL}
      />

      {readoutMode !== 'off' && (
        <>
          <View style={styles.separator} />
          <ButtonGroupRow
            title={s.calcTerminology}
            options={mathLevelOptions}
            selectedId={mathLevel}
            onSelect={id => { setMathLevel(id as MathLevel); onSettingsChange?.(); }}
            isRTL={isRTL}
          />
          <View style={styles.separator} />
          <ButtonGroupRow
            title={s.speechSpeed}
            options={rateOptions}
            selectedId={currentRateId}
            onSelect={handleRateChange}
            isRTL={isRTL}
          />
          <View style={styles.separator} />
          <ButtonGroupRow
            title={s.voicePitch}
            options={pitchOptions}
            selectedId={currentPitchId}
            onSelect={handlePitchChange}
            isRTL={isRTL}
          />
          <View style={styles.separator} />
          <ButtonGroupRow
            title={s.calcDecimalDigits}
            options={decimalOptions}
            selectedId={String(decimalDigits)}
            onSelect={id => { setDecimalDigits(parseInt(id, 10)); onSettingsChange?.(); }}
            isRTL={isRTL}
          />
          <View style={styles.separator} />
          <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{strings.settings.tabs.voice}</Text>
          <View style={[styles.pickerControl, isRTL && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity
              style={[styles.pickerDropdown, isRTL && { flexDirection: 'row-reverse' }]}
              onPress={toggleExpanded}
              activeOpacity={0.7}>
              <Text style={[styles.pickerValue, isRTL && { textAlign: 'right' }]} numberOfLines={1}>
                {selectedVoice ? `${selectedVoice.name} (${getLanguageDisplayName(selectedVoice.language, uiLang)})` : strings.settingsModal.none}
              </Text>
              <Text style={[styles.pickerArrow, isRTL && { marginLeft: 0, marginRight: 8 }]}>{expanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {selectedVoice && (
              <TouchableOpacity
                style={styles.testButton}
                onPress={() => handleTest(selectedVoice)}
                activeOpacity={0.7}>
                <Text style={styles.testButtonText}>{s.test}</Text>
              </TouchableOpacity>
            )}
          </View>

          {expanded && (
            loading ? (
              <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 8 }} />
            ) : (
              <View style={styles.dropdownList}>
                {/* Language search */}
                <View style={[styles.searchRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={[styles.searchInput, isRTL && { textAlign: 'right' }]}
                    value={langQuery}
                    onChangeText={setLangQuery}
                    placeholder={s.searchLanguage}
                    placeholderTextColor="#9CA3AF"
                    autoCorrect={false}
                    autoCapitalize="none"
                    clearButtonMode="never"
                    returnKeyType="search"
                  />
                  {langQuery.length > 0 && (
                    <TouchableOpacity
                      style={styles.searchClear}
                      onPress={() => setLangQuery('')}
                      activeOpacity={0.7}>
                      <Text style={styles.searchClearText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {groupedVoices.length === 0 && (
                  <Text style={styles.noResults}>{s.noLanguageMatches}</Text>
                )}

                {groupedVoices.map(group => (
                  <View key={group.lang}>
                    <Text style={styles.langHeader}>{getLanguageDisplayName(group.lang, uiLang).toUpperCase()}</Text>
                    {group.voices.map(v => {
                      const isSelected = voiceId === v.id;
                      return (
                        <View key={v.id} style={[styles.voiceRow, isSelected && styles.voiceRowSelected, isRTL && { flexDirection: 'row-reverse' }]}>
                          <TouchableOpacity
                            style={styles.voiceInfo}
                            onPress={() => handleVoiceSelect(v)}>
                            <Text style={[styles.voiceName, isSelected && styles.voiceNameSelected, isRTL && { textAlign: 'right' }]}>
                              {v.name}
                            </Text>
                            <Text style={[styles.voiceLang, isRTL && { textAlign: 'right' }]}>{getLanguageDisplayName(v.language, uiLang)}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.voiceTestBtn}
                            onPress={() => handleTest(v)}
                            activeOpacity={0.7}>
                            <Text style={styles.voiceTestBtnText}>{s.test}</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            )
          )}
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#E2E8F0', marginVertical: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 4 },
  pickerControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerDropdown: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    ...subtleShadow,
  },
  pickerValue: { flex: 1, fontSize: 14, fontWeight: '500', color: '#1F2937' },
  pickerArrow: { fontSize: 10, color: '#6B7280', marginLeft: 8 },
  testButton: { backgroundColor: '#3B82F6', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  testButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  dropdownList: { marginTop: 8, borderRadius: 10, backgroundColor: '#F9FAFB', overflow: 'hidden', ...subtleShadow },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  searchIcon: { fontSize: 13, marginHorizontal: 6, color: '#9CA3AF' },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937', padding: 0 },
  searchClear: { paddingHorizontal: 8, paddingVertical: 4 },
  searchClearText: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
  noResults: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 16 },
  langHeader: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  voiceRowSelected: { backgroundColor: '#3B82F615' },
  voiceInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  voiceName: { fontSize: 14, fontWeight: '500', color: '#1F2937' },
  voiceNameSelected: { color: '#3B82F6', fontWeight: '600' },
  voiceLang: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  voiceTestBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  voiceTestBtnText: { fontSize: 13, fontWeight: '600', color: '#3B82F6' },
});

export default CalcVoiceSettingsPanel;
