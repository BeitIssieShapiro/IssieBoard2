import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import TTS from '../../../issievoice/src/services/TextToSpeech';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

const READOUT_MODE_KEY = 'issiecalc_readout_mode';
const RATE_KEY = 'issiecalc_tts_rate';
const PITCH_KEY = 'issiecalc_tts_pitch';
const VOICE_ID_KEY = 'issiecalc_tts_voice_id';
const LANGUAGE_KEY = 'issiecalc_tts_language';
const DECIMAL_DIGITS_KEY = 'issiecalc_tts_decimal_digits';

export type ReadoutMode = 'off' | 'every-digit' | 'every-number';

interface CalcTTSContextValue {
  readoutMode: ReadoutMode;
  rate: number;
  pitch: number;
  voiceId: string | null;
  language: string | null;
  decimalDigits: number;
  setReadoutMode: (mode: ReadoutMode) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVoice: (voiceId: string, language: string) => void;
  setDecimalDigits: (n: number) => void;
  readout: (keyValue: string, expression: string, result: string, angleMode?: 'deg' | 'rad') => void;
}

const CalcTTSContext = createContext<CalcTTSContextValue | null>(null);

const SILENT_KEYS = new Set(['⌫', 'AC', '+/-', '[2ND]', '[2ND_OFF]', '[ANGLE_TOGGLE]', 'ms', 'mr', 'rand']);

const OPERATOR_KEYS = new Set(['+', '-', '*', '/', '^', '%']);

// Trig functions that take an angle argument
const ANGLE_FUNCTIONS = new Set(['sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(']);

// Functions that wrap an existing operand (used in every-number mode)
const WRAPPING_FUNCTIONS = new Set([
  'sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(',
  'sinh(', 'cosh(', 'tanh(', 'asinh(', 'acosh(', 'atanh(',
  'sqrt(', 'ln(', 'log(', 'log2(', 'logy(', '2root(', '3root(', 'yroot(', 'factorial(',
  'x^2', 'x^3',
]);

// Localized "of" connectors and angle unit words
const LANG_OF: Record<string, string> = { en: 'of', he: 'של', ar: 'من' };
const LANG_DEG: Record<string, string> = { en: 'degrees', he: 'מעלות', ar: 'درجات' };
const LANG_RAD: Record<string, string> = { en: 'radians', he: 'רדיאנים', ar: 'راديان' };

function getLangWord(map: Record<string, string>, language: string | null): string {
  const prefix = (language ?? '').split('-')[0].toLowerCase();
  return map[prefix] ?? map.en;
}

type SubMap = Record<string, string>;

const SUBSTITUTIONS: Record<string, SubMap> = {
  en: {
    '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by',
    '^': 'to the power of', '%': 'percent',
    'sqrt(': 'square root', 'ln(': 'ln', 'log(': 'log', 'log2(': 'log base 2',
    'logy(': 'log base y', '2root(': 'square root', '3root(': 'cube root', 'yroot(': 'y root',
    'factorial(': 'factorial', 'sin(': 'sine', 'cos(': 'cosine', 'tan(': 'tangent',
    'asin(': 'arc sine', 'acos(': 'arc cosine', 'atan(': 'arc tangent',
    'sinh(': 'hyperbolic sine', 'cosh(': 'hyperbolic cosine', 'tanh(': 'hyperbolic tangent',
    'asinh(': 'inverse hyperbolic sine', 'acosh(': 'inverse hyperbolic cosine', 'atanh(': 'inverse hyperbolic tangent',
    'x^2': 'squared', 'x^3': 'cubed', 'x^(': 'to the power',
    '^(': 'to the power', '2^(': '2 to the power', '1/(': '1 over',
    '(': 'open parenthesis', ')': 'close parenthesis',
    'pi': 'pi', 'e': 'e', '=': 'equals',
  },
  he: {
    '+': 'ועוד', '-': 'פחות', '*': 'כפול', '/': 'חלקי',
    '^': 'בחזקת', '%': 'אחוז',
    'sqrt(': 'שורש', 'ln(': 'ln', 'log(': 'לוג', 'log2(': 'לוג בסיס 2',
    'logy(': 'לוג בסיס y', '2root(': 'שורש ריבועי', '3root(': 'שורש שלישי', 'yroot(': 'שורש y',
    'factorial(': 'עצרת', 'sin(': 'סינוס', 'cos(': 'קוסינוס', 'tan(': 'טנגנס',
    'asin(': 'ארקסינוס', 'acos(': 'ארקקוסינוס', 'atan(': 'ארקטנגנס',
    'sinh(': 'סינוס היפרבולי', 'cosh(': 'קוסינוס היפרבולי', 'tanh(': 'טנגנס היפרבולי',
    'asinh(': 'ארקסינוס היפרבולי', 'acosh(': 'ארקקוסינוס היפרבולי', 'atanh(': 'ארקטנגנס היפרבולי',
    'x^2': 'בריבוע', 'x^3': 'בשלישית', 'x^(': 'בחזקת',
    '^(': 'בחזקת', '2^(': '2 בחזקת', '1/(': '1 חלקי',
    '(': 'סוגר פתוח', ')': 'סוגר סגור',
    'pi': 'פאי', 'e': 'e', '=': 'שווה',
  },
  ar: {
    '+': 'زائد', '-': 'ناقص', '*': 'مضروب', '/': 'مقسوم على',
    '^': 'أس', '%': 'بالمئة',
    'sqrt(': 'جذر تربيعي', 'ln(': 'لوغاريتم طبيعي', 'log(': 'لوغاريتم', 'log2(': 'لوغاريتم أساس 2',
    'logy(': 'لوغاريتم أساس y', '2root(': 'جذر تربيعي', '3root(': 'جذر تكعيبي', 'yroot(': 'جذر y',
    'factorial(': 'مضروب', 'sin(': 'جيب', 'cos(': 'جيب التمام', 'tan(': 'ظل',
    'asin(': 'جيب معكوس', 'acos(': 'جيب التمام المعكوس', 'atan(': 'ظل معكوس',
    'sinh(': 'جيب زائدي', 'cosh(': 'جيب تمام زائدي', 'tanh(': 'ظل زائدي',
    'asinh(': 'جيب زائدي معكوس', 'acosh(': 'جيب تمام زائدي معكوس', 'atanh(': 'ظل زائدي معكوس',
    'x^2': 'تربيع', 'x^3': 'تكعيب', 'x^(': 'أس',
    '^(': 'أس', '2^(': '2 أس', '1/(': '1 على',
    '(': 'قوس مفتوح', ')': 'قوس مغلق',
    'pi': 'باي', 'e': 'e', '=': 'يساوي',
  },
};

function getSubMap(language: string | null): SubMap {
  const prefix = (language ?? '').split('-')[0].toLowerCase();
  return SUBSTITUTIONS[prefix] ?? SUBSTITUTIONS.en;
}

function getOperatorName(key: string, language: string | null): string {
  const map = getSubMap(language);
  return map[key] ?? key;
}

function extractLastOperand(expression: string): string {
  // Strip outer function call: sin(50) → 50, sin(50)+3 finds 3 after +
  const match = expression.match(/([+\-*\/^%])([^+\-*\/^%]*)$/);
  if (match) {
    // operand after last operator — strip any leading function name
    const part = match[2].trim();
    const inner = part.replace(/^[a-zA-Z]+\(/, '').replace(/\)$/, '');
    return inner || part;
  }
  // Whole expression — extract number inside outermost function call if present
  const funcMatch = expression.match(/^[a-zA-Z]+\((.+)\)$/);
  if (funcMatch) return funcMatch[1];
  return expression.trim();
}

const LANG_MORE_DIGITS: Record<string, (n: number) => string> = {
  en: (n) => `and ${n} more digit${n === 1 ? '' : 's'}`,
  he: (n) => `ועוד ${n} סְפָרוֹת`,
  ar: (n) => `و ${n} أرقام إضافية`,
};

function formatResult(result: string, decimalDigits: number, language: string | null): string {
  if (decimalDigits === -1) return result; // "all" — read as-is

  const dotIdx = result.indexOf('.');
  if (dotIdx === -1) return result; // whole number — read as-is

  const actualDecimals = result.length - dotIdx - 1;
  if (actualDecimals <= decimalDigits) return result; // fewer or equal digits — read as-is

  // Truncate (not round) to decimalDigits
  const truncated = result.slice(0, dotIdx + 1 + decimalDigits);
  const extra = actualDecimals - decimalDigits;
  const prefix = (language ?? '').split('-')[0].toLowerCase();
  const moreFn = LANG_MORE_DIGITS[prefix] ?? LANG_MORE_DIGITS.en;
  return `${truncated} ${moreFn(extra)}`;
}

export const CalcTTSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [readoutMode, setReadoutModeState] = useState<ReadoutMode>('off');
  const [rate, setRateState] = useState(0.5);
  const [pitch, setPitchState] = useState(1.0);
  const [voiceId, setVoiceIdState] = useState<string | null>(null);
  const [language, setLanguageState] = useState<string | null>(null);
  const [decimalDigits, setDecimalDigitsState] = useState(2);

  const readoutModeRef = useRef<ReadoutMode>('off');
  const rateRef = useRef(0.5);
  const pitchRef = useRef(1.0);
  const voiceIdRef = useRef<string | null>(null);
  const languageRef = useRef<string | null>(null);
  const decimalDigitsRef = useRef(2);

  useEffect(() => {
    TTS.initialize().then(() => {
      Promise.all([
        KeyboardPreferences.getString(READOUT_MODE_KEY),
        KeyboardPreferences.getString(RATE_KEY),
        KeyboardPreferences.getString(PITCH_KEY),
        KeyboardPreferences.getString(VOICE_ID_KEY),
        KeyboardPreferences.getString(LANGUAGE_KEY),
        KeyboardPreferences.getString(DECIMAL_DIGITS_KEY),
      ]).then(([mode, rateStr, pitchStr, vid, lang, decStr]) => {
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
        if (decStr) {
          const d = parseInt(decStr, 10);
          if (!isNaN(d)) { decimalDigitsRef.current = d; setDecimalDigitsState(d); }
        }
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

  const setDecimalDigits = useCallback((n: number) => {
    decimalDigitsRef.current = n;
    setDecimalDigitsState(n);
    KeyboardPreferences.setString(DECIMAL_DIGITS_KEY, String(n));
  }, []);

  const speak = useCallback(async (text: string) => {
    try {
      await TTS.stop();
      await TTS.speak(text);
    } catch {}
  }, []);

  const readout = useCallback((keyValue: string, expression: string, result: string, angleMode?: 'deg' | 'rad') => {
    const mode = readoutModeRef.current;
    if (mode === 'off') return;
    if (SILENT_KEYS.has(keyValue)) return;

    const lang = languageRef.current;

    if (mode === 'every-digit') {
      if (keyValue === '=') {
        const eq = getSubMap(lang)['='] ?? 'equals';
        const spoken = result === 'Error' ? `${eq} error` : `${eq} ${formatResult(result, decimalDigitsRef.current, lang)}`;
        speak(spoken);
        return;
      }
      speak(getSubMap(lang)[keyValue] ?? keyValue);
      return;
    }

    if (mode === 'every-number') {
      if (keyValue === '=') {
        const eq = getSubMap(lang)['='] ?? 'equals';
        // If expression ends with a closed function call (e.g. sin(60)), the function
        // was already read aloud — just say "equals result"
        const endsWithFunction = /[a-zA-Z]+\([^)]*\)$/.test(expression.trim());
        if (endsWithFunction) {
          const spoken = result === 'Error' ? `${eq} error` : `${eq} ${formatResult(result, decimalDigitsRef.current, lang)}`;
          speak(spoken);
        } else {
          const operand = extractLastOperand(expression);
          const spoken = result === 'Error' ? `${operand} ${eq} error` : `${operand} ${eq} ${formatResult(result, decimalDigitsRef.current, lang)}`;
          speak(spoken);
        }
        return;
      }
      if (OPERATOR_KEYS.has(keyValue)) {
        const beforeOp = expression.slice(0, -1).trim();
        const operand = extractLastOperand(beforeOp || expression);
        speak(`${operand} ${getOperatorName(keyValue, lang)}`);
        return;
      }
      if (WRAPPING_FUNCTIONS.has(keyValue)) {
        const operand = extractLastOperand(expression);
        const fnName = getSubMap(lang)[keyValue] ?? keyValue;
        const of_ = getLangWord(LANG_OF, lang);
        if (operand && ANGLE_FUNCTIONS.has(keyValue) && angleMode) {
          const unit = angleMode === 'deg'
            ? getLangWord(LANG_DEG, lang)
            : getLangWord(LANG_RAD, lang);
          speak(`${fnName} ${of_} ${operand} ${unit}`);
        } else if (operand) {
          speak(`${fnName} ${of_} ${operand}`);
        } else {
          speak(fnName);
        }
        return;
      }
    }
  }, [speak]);

  return (
    <CalcTTSContext.Provider value={{
      readoutMode, rate, pitch, voiceId, language, decimalDigits,
      setReadoutMode, setRate, setPitch, setVoice, setDecimalDigits, readout,
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
