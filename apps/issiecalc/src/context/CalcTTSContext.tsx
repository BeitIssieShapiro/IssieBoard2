import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import TTS from '../../../issievoice/src/services/TextToSpeech';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

const READOUT_MODE_KEY = 'issiecalc_readout_mode';
const RATE_KEY = 'issiecalc_tts_rate';
const PITCH_KEY = 'issiecalc_tts_pitch';
const VOICE_ID_KEY = 'issiecalc_tts_voice_id';
const LANGUAGE_KEY = 'issiecalc_tts_language';

export type ReadoutMode = 'off' | 'every-digit' | 'every-number';

interface CalcTTSContextValue {
  readoutMode: ReadoutMode;
  rate: number;
  pitch: number;
  voiceId: string | null;
  language: string | null;
  setReadoutMode: (mode: ReadoutMode) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVoice: (voiceId: string, language: string) => void;
  readout: (keyValue: string, expression: string, result: string) => void;
}

const CalcTTSContext = createContext<CalcTTSContextValue | null>(null);

const SILENT_KEYS = new Set(['⌫', 'AC', '+/-', '[2ND]', '[2ND_OFF]', '[ANGLE_TOGGLE]', 'ms', 'mr', 'rand']);

const OPERATOR_KEYS = new Set(['+', '-', '*', '/', '^', '%']);

const DIGIT_SUBSTITUTIONS: Record<string, string> = {
  '*': 'times',
  '/': 'divided by',
  '+': 'plus',
  '-': 'minus',
  '^': 'to the power of',
  '%': 'percent',
  'sqrt(': 'square root',
  'ln(': 'ln',
  'log(': 'log',
  '(': 'open parenthesis',
  ')': 'close parenthesis',
  'pi': 'pi',
  'e': 'e',
};

const OPERATOR_NAMES: Record<string, string> = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divided by',
  '^': 'to the power of',
  '%': 'percent',
};

function extractLastOperand(expression: string): string {
  const match = expression.match(/([+\-*\/^%])([^+\-*\/^%]*)$/);
  if (match) return match[2].trim();
  return expression.trim();
}

export const CalcTTSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [readoutMode, setReadoutModeState] = useState<ReadoutMode>('off');
  const [rate, setRateState] = useState(0.5);
  const [pitch, setPitchState] = useState(1.0);
  const [voiceId, setVoiceIdState] = useState<string | null>(null);
  const [language, setLanguageState] = useState<string | null>(null);

  const readoutModeRef = useRef<ReadoutMode>('off');
  const rateRef = useRef(0.5);
  const pitchRef = useRef(1.0);
  const voiceIdRef = useRef<string | null>(null);
  const languageRef = useRef<string | null>(null);

  useEffect(() => {
    TTS.initialize().then(() => {
      Promise.all([
        KeyboardPreferences.getString(READOUT_MODE_KEY),
        KeyboardPreferences.getString(RATE_KEY),
        KeyboardPreferences.getString(PITCH_KEY),
        KeyboardPreferences.getString(VOICE_ID_KEY),
        KeyboardPreferences.getString(LANGUAGE_KEY),
      ]).then(([mode, rateStr, pitchStr, vid, lang]) => {
        if (mode === 'off' || mode === 'every-digit' || mode === 'every-number') {
          readoutModeRef.current = mode;
          setReadoutModeState(mode);
        }
        if (rateStr) {
          const r = parseFloat(rateStr);
          if (!isNaN(r)) { rateRef.current = r; setRateState(r); TTS.setRate(r); }
        }
        if (pitchStr) {
          const p = parseFloat(pitchStr);
          if (!isNaN(p)) { pitchRef.current = p; setPitchState(p); TTS.setPitch(p); }
        }
        if (lang) { languageRef.current = lang; setLanguageState(lang); TTS.setLanguage(lang); }
        if (vid) { voiceIdRef.current = vid; setVoiceIdState(vid); TTS.setVoice(vid); }
      });
    });
  }, []);

  const setReadoutMode = useCallback((mode: ReadoutMode) => {
    readoutModeRef.current = mode;
    setReadoutModeState(mode);
    KeyboardPreferences.setString(READOUT_MODE_KEY, mode);
  }, []);

  const setRate = useCallback((r: number) => {
    rateRef.current = r;
    setRateState(r);
    KeyboardPreferences.setString(RATE_KEY, String(r));
    TTS.setRate(r);
  }, []);

  const setPitch = useCallback((p: number) => {
    pitchRef.current = p;
    setPitchState(p);
    KeyboardPreferences.setString(PITCH_KEY, String(p));
    TTS.setPitch(p);
  }, []);

  const setVoice = useCallback((vid: string, lang: string) => {
    voiceIdRef.current = vid;
    languageRef.current = lang;
    setVoiceIdState(vid);
    setLanguageState(lang);
    KeyboardPreferences.setString(VOICE_ID_KEY, vid);
    KeyboardPreferences.setString(LANGUAGE_KEY, lang);
    TTS.setLanguage(lang);
    TTS.setVoice(vid);
  }, []);

  const speak = useCallback(async (text: string) => {
    try {
      await TTS.speak(text);
    } catch {}
  }, []);

  const readout = useCallback((keyValue: string, expression: string, result: string) => {
    const mode = readoutModeRef.current;
    if (mode === 'off') return;
    if (SILENT_KEYS.has(keyValue)) return;

    if (mode === 'every-digit') {
      if (keyValue === '=') {
        const spoken = result === 'Error' ? 'equals error' : `equals ${result}`;
        speak(spoken);
        return;
      }
      const text = DIGIT_SUBSTITUTIONS[keyValue] ?? keyValue;
      speak(text);
      return;
    }

    if (mode === 'every-number') {
      if (keyValue === '=') {
        const operand = extractLastOperand(expression);
        const spoken = result === 'Error' ? 'error' : `${operand} equals ${result}`;
        speak(spoken);
        return;
      }
      if (OPERATOR_KEYS.has(keyValue)) {
        const beforeOp = expression.slice(0, -1).trim();
        const operand = extractLastOperand(beforeOp || expression);
        const opName = OPERATOR_NAMES[keyValue] ?? keyValue;
        speak(`${operand} ${opName}`);
        return;
      }
    }
  }, [speak]);

  return (
    <CalcTTSContext.Provider value={{
      readoutMode, rate, pitch, voiceId, language,
      setReadoutMode, setRate, setPitch, setVoice, readout,
    }}>
      {children}
    </CalcTTSContext.Provider>
  );
};

export function useCalcTTS(): CalcTTSContextValue {
  const ctx = useContext(CalcTTSContext);
  if (!ctx) throw new Error('useCalcTTS must be used inside CalcTTSProvider');
  return ctx;
}
