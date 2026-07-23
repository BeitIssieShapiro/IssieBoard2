import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useCalcTTS } from '../context/CalcTTSContext';
import { ButtonGroupRow } from '../../../../src/components/shared/ButtonGroupRow';
import TTS from '../../../issievoice/src/services/TextToSpeech';
import { subtleShadow } from '../../../../src/styles/shadows';

interface Voice {
  id: string;
  name: string;
  language: string;
}

const CalcVoiceSettingsPanel: React.FC = () => {
  const { readoutMode, rate, pitch, voiceId, decimalDigits, setReadoutMode, setRate, setPitch, setVoice, setDecimalDigits } = useCalcTTS();
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    TTS.getAvailableVoices().then(v => {
      setVoices(v);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleRateChange = useCallback((id: string) => {
    const map: Record<string, number> = { slow: 0.3, normal: 0.5, fast: 0.7 };
    setRate(map[id]);
  }, [setRate]);

  const handlePitchChange = useCallback((id: string) => {
    const map: Record<string, number> = { low: 0.8, normal: 1.0, high: 1.2 };
    setPitch(map[id]);
  }, [setPitch]);

  const handleVoiceSelect = useCallback((voice: Voice) => {
    setVoice(voice.id, voice.language);
    setExpanded(false);
  }, [setVoice]);

  const handleTest = useCallback(async (voice: Voice) => {
    try {
      await TTS.setLanguage(voice.language);
      await TTS.setVoice(voice.id);
      await TTS.speak('Hello');
    } catch {}
  }, []);

  const decimalOptions = [
    { id: '0', label: '0' },
    { id: '1', label: '1' },
    { id: '2', label: '2' },
    { id: '3', label: '3' },
    { id: '4', label: '4' },
    { id: '-1', label: 'All' },
  ];

  const currentRateId = rate <= 0.3 ? 'slow' : rate >= 0.7 ? 'fast' : 'normal';
  const currentPitchId = pitch <= 0.8 ? 'low' : pitch >= 1.2 ? 'high' : 'normal';
  const selectedVoice = voices.find(v => v.id === voiceId);

  const readoutOptions = [
    { id: 'off', label: 'Off' },
    { id: 'every-digit', label: 'Every digit' },
    { id: 'every-number', label: 'Every number' },
  ];

  const rateOptions = [
    { id: 'slow', label: 'Slow' },
    { id: 'normal', label: 'Normal' },
    { id: 'fast', label: 'Fast' },
  ];

  const pitchOptions = [
    { id: 'low', label: 'Low' },
    { id: 'normal', label: 'Normal' },
    { id: 'high', label: 'High' },
  ];

  const groupedVoices: { lang: string; voices: Voice[] }[] = [];
  voices.forEach(v => {
    const lang = v.language.split('-')[0];
    const group = groupedVoices.find(g => g.lang === lang);
    if (group) group.voices.push(v);
    else groupedVoices.push({ lang, voices: [v] });
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ButtonGroupRow
        title="Readout"
        options={readoutOptions}
        selectedId={readoutMode}
        onSelect={id => setReadoutMode(id as any)}
      />

      {readoutMode !== 'off' && (
        <>
          <View style={styles.separator} />
          <ButtonGroupRow
            title="Speed"
            options={rateOptions}
            selectedId={currentRateId}
            onSelect={handleRateChange}
          />
          <View style={styles.separator} />
          <ButtonGroupRow
            title="Pitch"
            options={pitchOptions}
            selectedId={currentPitchId}
            onSelect={handlePitchChange}
          />
          <View style={styles.separator} />
          <ButtonGroupRow
            title="How many digits after decimal point to readout"
            options={decimalOptions}
            selectedId={String(decimalDigits)}
            onSelect={id => setDecimalDigits(parseInt(id, 10))}
          />
          <View style={styles.separator} />
          <Text style={styles.sectionTitle}>Voice</Text>
          <View style={styles.pickerControl}>
            <TouchableOpacity
              style={styles.pickerDropdown}
              onPress={() => setExpanded(e => !e)}
              activeOpacity={0.7}>
              <Text style={styles.pickerValue} numberOfLines={1}>
                {selectedVoice ? `${selectedVoice.name} (${selectedVoice.language})` : 'None selected'}
              </Text>
              <Text style={styles.pickerArrow}>{expanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {selectedVoice && (
              <TouchableOpacity
                style={styles.testButton}
                onPress={() => handleTest(selectedVoice)}
                activeOpacity={0.7}>
                <Text style={styles.testButtonText}>Test</Text>
              </TouchableOpacity>
            )}
          </View>

          {expanded && (
            loading ? (
              <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 8 }} />
            ) : (
              <View style={styles.dropdownList}>
                {groupedVoices.map(group => (
                  <View key={group.lang}>
                    <Text style={styles.langHeader}>{group.lang.toUpperCase()}</Text>
                    {group.voices.map(v => {
                      const isSelected = voiceId === v.id;
                      return (
                        <View key={v.id} style={[styles.voiceRow, isSelected && styles.voiceRowSelected]}>
                          <TouchableOpacity
                            style={styles.voiceInfo}
                            onPress={() => handleVoiceSelect(v)}>
                            <Text style={[styles.voiceName, isSelected && styles.voiceNameSelected]}>
                              {v.name}
                            </Text>
                            <Text style={styles.voiceLang}>{v.language}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.voiceTestBtn}
                            onPress={() => handleTest(v)}
                            activeOpacity={0.7}>
                            <Text style={styles.voiceTestBtnText}>Test</Text>
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
