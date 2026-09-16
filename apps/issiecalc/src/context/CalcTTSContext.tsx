import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import TTS from '../../../issievoice/src/services/TextToSpeech';

export type ReadoutMode = 'off' | 'every-digit' | 'every-number' | 'both';
export type MathLevel = 'young' | 'standard';

export interface VoiceSettings {
  readoutMode: ReadoutMode;
  rate: number;
  pitch: number;
  voiceId: string | null;
  language: string | null;
  decimalDigits: number;
  mathLevel: MathLevel;
}

interface CalcTTSContextValue {
  readoutMode: ReadoutMode;
  rate: number;
  pitch: number;
  voiceId: string | null;
  language: string | null;
  decimalDigits: number;
  mathLevel: MathLevel;
  setReadoutMode: (mode: ReadoutMode) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVoice: (voiceId: string, language: string) => void;
  setDecimalDigits: (n: number) => void;
  setMathLevel: (level: MathLevel) => void;
  readout: (keyValue: string, expression: string, result: string, angleMode?: 'deg' | 'rad') => void;
  loadFromConfig: (settings: Partial<VoiceSettings> | undefined) => void;
  getVoiceSettings: () => VoiceSettings;
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
  // Template keys (xʸ, ʸ√, logᵧ). They wrap the operand like the rest, but
  // dispatch rewrites them (x^( → xpow(x,•)) and waits for a second operand,
  // so without this they fell through every branch and read nothing at all.
  'x^(', 'yroot(', 'logy(', '10^(', '2^(', 'e^(',
]);

// Postfix functions: operand comes first in readout ("[operand] [fn]")
// x^( reads "8 to the power" — the exponent follows as you type it. 10ˣ/2ˣ/eˣ
// name their own base, so they read "times 10 to the power" instead (they
// multiply onto the operand rather than raising it).
const POSTFIX_FUNCTIONS = new Set(['x^2', 'x^3', 'factorial(', 'x^(', '10^(', '2^(', 'e^(']);

// The keys whose base is part of the key itself (10ˣ, 2ˣ, eˣ). dispatch turns
// them into `<operand>*xpow(<base>,•)`, so the readout must take the operand
// from before the multiply and join it with "times".
const CONSTANT_BASE_POWERS = new Set(['10^(', '2^(', 'e^(']);

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
    '^(': 'to the power', '2^(': '2 to the power', '10^(': '10 to the power', 'e^(': 'e to the power', '1/(': '1 over',
    '(': 'open parenthesis', ')': 'close parenthesis',
    'pi': 'pi', 'e': 'e', '=': 'equals',
  },
  he: {
    '+': 'פלוס', '-': 'פחות', '*': 'כפול', '/': 'חֵלְקֵי',
    '^': 'בחזקת', '%': 'אחוז',
    'sqrt(': 'שורש', 'ln(': 'ln', 'log(': 'לוג', 'log2(': 'לוג בסיס 2',
    'logy(': 'לוג בסיס y', '2root(': 'שורש ריבועי', '3root(': 'שורש שלישי', 'yroot(': 'שורש y',
    'factorial(': 'עצרת', 'sin(': 'סינוס', 'cos(': 'קוסינוס', 'tan(': 'טנגנס',
    'asin(': 'ארקסינוס', 'acos(': 'ארקקוסינוס', 'atan(': 'ארקטנגנס',
    'sinh(': 'סינוס היפרבולי', 'cosh(': 'קוסינוס היפרבולי', 'tanh(': 'טנגנס היפרבולי',
    'asinh(': 'ארקסינוס היפרבולי', 'acosh(': 'ארקקוסינוס היפרבולי', 'atanh(': 'ארקטנגנס היפרבולי',
    'x^2': 'בָּרִיבּוּעַ', 'x^3': 'בָּשְׁלִישִׁית', 'x^(': 'בחזקת',
    '^(': 'בחזקת', '2^(': '2 בחזקת', '10^(': '10 בחזקת', 'e^(': 'e בחזקת', '1/(': '1 חלקי',
    '(': 'סוגר פתוח', ')': 'סוגר סגור',
    'pi': 'פאי', 'e': 'e', '=': 'שָׁוֶה',
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
    '^(': 'أس', '2^(': '2 أس', '10^(': '10 أس', 'e^(': 'e أس', '1/(': '1 على',
    '(': 'قوس مفتوح', ')': 'قوس مغلق',
    'pi': 'باي', 'e': 'e', '=': 'يساوي',
  },
};

// Young-level overrides per language (only keys that differ)
const YOUNG_OVERRIDES: Partial<Record<string, SubMap>> = {
  he: {
    '+': 'ועוד', '-': 'פחות', '*': 'פַּעֲמִים', '/': 'חֵלְקֵי',
  },
};

function getSubMap(language: string | null, mathLevel?: MathLevel): SubMap {
  const prefix = (language ?? '').split('-')[0].toLowerCase();
  const base = SUBSTITUTIONS[prefix] ?? SUBSTITUTIONS.en;
  if (mathLevel === 'young' && YOUNG_OVERRIDES[prefix]) {
    return { ...base, ...YOUNG_OVERRIDES[prefix] };
  }
  return base;
}

function getOperatorName(key: string, language: string | null, mathLevel?: MathLevel): string {
  const map = getSubMap(language, mathLevel);
  return map[key] ?? key;
}

// Pressing a wrapping function wraps the current operand, so 8 then 3root(
// gives `3root(8)`. Stripping the name back off must therefore cope with names
// that a `[a-zA-Z]+` pattern misses: 2root(/3root( open with a digit and log2(
// ends with one. Left unstripped, the name is tokenized and spoken a second
// time ("cube root of 3root 8"). Built from WRAPPING_FUNCTIONS, longest first
// so 3root( wins over any shorter overlapping name.
const LEADING_CALL = new RegExp(
  '^(?:' + [...WRAPPING_FUNCTIONS]
    .filter(f => f.endsWith('('))
    .sort((a, b) => b.length - a.length)
    .map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|') + ')'
);

// A half-built template: dispatch rewrites x^( to `xpow(8,)` (the \x00 marker
// is stripped before we see it) and waits for the exponent. The operand being
// wrapped is the first argument.
//
// Unanchored at the front because 10ˣ/2ˣ/eˣ multiply onto what precedes them
// (5 then 10ˣ → `5*xpow(10,)`), so the template is only at the end.
const PENDING_TEMPLATE = /(?:xpow|yroot|logy)\(([^,]*),\s*\)$/;

// The same template once its second argument is filled in: xpow(2,3).
const COMPLETED_TEMPLATE = /(?:xpow|yroot|logy)\(([^,]*),([^,)]+)\)$/;

/** `(5` → `5`: an unclosed paren carries nothing to say. */
function stripOpenParen(s: string): string {
  const stripped = s.replace(/^\(+/, '');
  return stripped || s;
}

function extractLastOperand(expression: string): string {
  const expr = expression.trim();
  const pending = expr.match(PENDING_TEMPLATE);
  if (pending) return pending[1];
  // Scan right-to-left for a binary operator (preceded by digit or closing paren)
  for (let i = expr.length - 1; i >= 1; i--) {
    const ch = expr[i];
    if ('+-*/^%'.includes(ch)) {
      const prev = expr[i - 1];
      // Only treat as binary operator if preceded by digit or )
      if (/[0-9)]/.test(prev)) {
        const part = expr.slice(i + 1).trim();
        // Strip outer parens: (-9) → -9
        const unparened = part.replace(/^\((.+)\)$/, '$1');
        // Strip leading function name: sin(50) → 50, 3root(8) → 8
        const inner = unparened.replace(LEADING_CALL, '').replace(/\)$/, '');
        // A still-open paren would otherwise be read out as part of the
        // operand ("(5"), so drop it.
        return stripOpenParen(inner || unparened || part);
      }
    }
  }
  // Whole expression — strip outer function call if present
  if (LEADING_CALL.test(expr) && expr.endsWith(')')) {
    return expr.replace(LEADING_CALL, '').replace(/\)$/, '');
  }
  return expr;
}

const LANG_MORE_DIGITS: Record<string, (n: number) => string> = {
  en: (n) => `and ${n} more digit${n === 1 ? '' : 's'}`,
  he: (n) => `ועוד ${n} סְפָרוֹת`,
  ar: (n) => `و ${n} أرقام إضافية`,
};

const LANG_MINUS: Record<string, string> = { en: 'minus', he: 'מינוס', ar: 'ناقص' };

function speakableNumber(value: string, language: string | null): string {
  const prefix = (language ?? '').split('-')[0].toLowerCase();
  if (value.startsWith('-')) {
    const minus = LANG_MINUS[prefix] ?? LANG_MINUS.en;
    return `${minus} ${value.slice(1)}`;
  }
  return value;
}

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
  const [mathLevel, setMathLevelState] = useState<MathLevel>('standard');

  const readoutModeRef = useRef<ReadoutMode>('off');
  const rateRef = useRef(0.5);
  const pitchRef = useRef(1.0);
  const voiceIdRef = useRef<string | null>(null);
  const languageRef = useRef<string | null>(null);
  const decimalDigitsRef = useRef(2);
  const mathLevelRef = useRef<MathLevel>('standard');

  const initializedRef = useRef(false);

  // True when the last keypress announced a complete power ("10 to the power
  // 3"), so "=" must not repeat the exponent. Only 10ˣ/2ˣ/eˣ set it: xʸ leaves
  // its slot open for an exponent that nothing has spoken yet.
  const powerFullySpokenRef = useRef(false);

  useEffect(() => {
    TTS.initialize().then(() => {
      initializedRef.current = true;
      // Only apply language and voice after init — rate/pitch are not re-applied on startup
      // (setDefaultRate has a known iOS TurboModule signature issue when called outside user action)
      if (languageRef.current) TTS.setLanguage(languageRef.current).catch(() => {});
      if (voiceIdRef.current) TTS.setVoice(voiceIdRef.current).catch(() => {});
    }).catch(() => {});
  }, []);

  const loadFromConfig = useCallback((settings: Partial<VoiceSettings> | undefined) => {
    const s = settings ?? {};
    const mode = (['off','every-digit','every-number','both'] as ReadoutMode[]).includes(s.readoutMode as ReadoutMode) ? s.readoutMode! : 'off';
    readoutModeRef.current = mode; setReadoutModeState(mode);
    const r = s.rate ?? 0.5; rateRef.current = r; setRateState(r);
    const p = s.pitch ?? 1.0; pitchRef.current = p; setPitchState(p);
    const lang = s.language ?? null; languageRef.current = lang; setLanguageState(lang);
    const vid = s.voiceId ?? null; voiceIdRef.current = vid; setVoiceIdState(vid);
    const dec = s.decimalDigits ?? 2; decimalDigitsRef.current = dec; setDecimalDigitsState(dec);
    const ml = (s.mathLevel === 'young' || s.mathLevel === 'standard') ? s.mathLevel : 'standard';
    mathLevelRef.current = ml; setMathLevelState(ml);
    // Apply TTS settings only after TTS is initialized
    if (initializedRef.current) {
      if (lang) TTS.setLanguage(lang).catch(() => {});
      if (vid) TTS.setVoice(vid).catch(() => {});
    }
  }, []);

  const getVoiceSettings = useCallback((): VoiceSettings => ({
    readoutMode: readoutModeRef.current,
    rate: rateRef.current,
    pitch: pitchRef.current,
    voiceId: voiceIdRef.current,
    language: languageRef.current,
    decimalDigits: decimalDigitsRef.current,
    mathLevel: mathLevelRef.current,
  }), []);

  const setReadoutMode = useCallback((mode: ReadoutMode) => {
    readoutModeRef.current = mode; setReadoutModeState(mode);
  }, []);

  const setRate = useCallback((r: number) => {
    rateRef.current = r; setRateState(r); TTS.setRate(r);
  }, []);

  const setPitch = useCallback((p: number) => {
    pitchRef.current = p; setPitchState(p); TTS.setPitch(p);
  }, []);

  const setVoice = useCallback((vid: string, lang: string) => {
    voiceIdRef.current = vid; languageRef.current = lang;
    setVoiceIdState(vid); setLanguageState(lang);
    TTS.setLanguage(lang); TTS.setVoice(vid);
  }, []);

  const setDecimalDigits = useCallback((n: number) => {
    decimalDigitsRef.current = n; setDecimalDigitsState(n);
  }, []);

  const setMathLevel = useCallback((level: MathLevel) => {
    mathLevelRef.current = level; setMathLevelState(level);
  }, []);

  const speak = useCallback((text: string) => {
    TTS.speak(text).catch(() => {});
  }, []);

  const speakWithPause = useCallback((before: string, after: string, pauseMs = 500) => {
    TTS.speak(before).catch(() => {});
    setTimeout(() => { TTS.speak(after).catch(() => {}); }, pauseMs);
  }, []);

  const readout = useCallback((keyValue: string, expression: string, result: string, angleMode?: 'deg' | 'rad') => {
    const mode = readoutModeRef.current;
    // Tracked for every key (even silent ones like AC, which must clear it) so
    // "=" knows whether the exponent has already been spoken. "=" itself leaves
    // it alone — it is the reader of this flag, not a writer.
    if (keyValue !== '=') {
      powerFullySpokenRef.current = CONSTANT_BASE_POWERS.has(keyValue);
    }
    if (mode === 'off') return;
    if (SILENT_KEYS.has(keyValue)) return;

    const lang = languageRef.current;
    const ml = mathLevelRef.current;

    if (mode === 'every-digit' || mode === 'both') {
      if (keyValue === '=') {
        // for 'both', fall through to every-number block which handles '='
        if (mode === 'every-digit') {
          const eq = getSubMap(lang, ml)['='] ?? 'equals';
          const res = result === 'Error' ? 'error' : speakableNumber(formatResult(result, decimalDigitsRef.current, lang), lang);
          speakWithPause(eq, res);
          return;
        }
      } else {
        speak(getSubMap(lang, ml)[keyValue] ?? keyValue);
        if (mode === 'every-digit') return;
      }
    }

    if (mode === 'every-number' || mode === 'both') {
      if (keyValue === '=') {
        const eq = getSubMap(lang, ml)['='] ?? 'equals';
        const endsWithFunction = /[a-zA-Z]+\([^)]*\)$/.test(expression.trim()) ||
          /x\^2$/.test(expression.trim()) || /x\^3$/.test(expression.trim());
        // A completed template (xʸ, ʸ√, logᵧ) ends in a function call too, but
        // only its first argument has been announced — pressing x^( said "2 to
        // the power" and the exponent typed after it was never spoken. Say the
        // second argument before "equals" so nothing is lost.
        //
        // 10ˣ/2ˣ/eˣ are the exception: they complete the power on the keypress
        // and announce all of it ("10 to the power 3"), so repeating the
        // exponent here would say it twice. The expression alone cannot tell
        // the two apart — xʸ pressed on a literal 10 also yields xpow(10,3) —
        // so this tracks which key actually built it.
        const template = powerFullySpokenRef.current
          ? null
          : expression.trim().match(COMPLETED_TEMPLATE);
        if (template) {
          const res = result === 'Error' ? 'error' : speakableNumber(formatResult(result, decimalDigitsRef.current, lang), lang);
          speak(speakableNumber(template[2], lang));
          setTimeout(() => speakWithPause(eq, res), 500);
        } else if (endsWithFunction) {
          const res = result === 'Error' ? 'error' : speakableNumber(formatResult(result, decimalDigitsRef.current, lang), lang);
          speakWithPause(eq, res);
        } else {
          const operand = speakableNumber(extractLastOperand(expression), lang);
          const res = result === 'Error' ? 'error' : speakableNumber(formatResult(result, decimalDigitsRef.current, lang), lang);
          speak(operand);
          setTimeout(() => speakWithPause(eq, res), 500);
        }
        return;
      }
      if (OPERATOR_KEYS.has(keyValue)) {
        const beforeOp = expression.slice(0, -1).trim();
        const operand = speakableNumber(extractLastOperand(beforeOp || expression), lang);
        speak(`${operand} ${getOperatorName(keyValue, lang, ml)}`);
        return;
      }
      if (WRAPPING_FUNCTIONS.has(keyValue)) {
        let operand: string;
        if (keyValue === 'x^2' || keyValue === 'x^3') {
          const base = expression.endsWith(keyValue) ? expression.slice(0, -keyValue.length) : expression;
          operand = speakableNumber(extractLastOperand(base), lang);
        } else if (CONSTANT_BASE_POWERS.has(keyValue)) {
          // `xpow(10,5)`: the key completes the power outright, and the number
          // that was typed is now the exponent — the second argument. The base
          // is the key's own, which the function name already says.
          const done = expression.match(COMPLETED_TEMPLATE);
          operand = done ? speakableNumber(done[2], lang) : '';
        } else {
          operand = speakableNumber(extractLastOperand(expression), lang);
        }
        const fnName = getSubMap(lang, ml)[keyValue] ?? keyValue;
        if (CONSTANT_BASE_POWERS.has(keyValue)) {
          // The power is complete when pressed: "10 to the power 5".
          speak(operand ? `${fnName} ${operand}` : fnName);
        } else if (POSTFIX_FUNCTIONS.has(keyValue)) {
          speak(operand ? `${operand} ${fnName}` : fnName);
        } else if (operand && ANGLE_FUNCTIONS.has(keyValue) && angleMode) {
          const of_ = getLangWord(LANG_OF, lang);
          const unit = angleMode === 'deg' ? getLangWord(LANG_DEG, lang) : getLangWord(LANG_RAD, lang);
          speak(`${fnName} ${of_} ${operand} ${unit}`);
        } else if (operand) {
          const of_ = getLangWord(LANG_OF, lang);
          speak(`${fnName} ${of_} ${operand}`);
        } else {
          speak(fnName);
        }
        return;
      }
    }
  }, [speak, speakWithPause]);

  return (
    <CalcTTSContext.Provider value={{
      readoutMode, rate, pitch, voiceId, language, decimalDigits, mathLevel,
      setReadoutMode, setRate, setPitch, setVoice, setDecimalDigits, setMathLevel,
      readout, loadFromConfig, getVoiceSettings,
    }}>
      {children}
    </CalcTTSContext.Provider>
  );
};

// POSTFIX_FUNCTIONS/LANG_OF/getLangWord are shared with CalcScreen's
// speakExpression so the speak button phrases calls ("cube root of 8",
// "5 factorial") exactly as the per-key readout above does.
export { getSubMap, speakableNumber, formatResult, getLangWord, POSTFIX_FUNCTIONS, LANG_OF };

export function useCalcTTS(): CalcTTSContextValue {
  const ctx = useContext(CalcTTSContext);
  if (!ctx) throw new Error('useCalcTTS must be used inside CalcTTSProvider');
  return ctx;
}
