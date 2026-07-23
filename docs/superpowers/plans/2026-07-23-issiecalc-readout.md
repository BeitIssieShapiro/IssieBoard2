# IssieCalc Readout (TTS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add text-to-speech readout to IssieCalc with two modes (every-digit, every-number) and a new Voice settings tab.

**Architecture:** A new `CalcTTSContext` wraps the shared `TextToSpeech` service directly. `CalcScreen` calls `readout(keyValue, expression, result)` after each key dispatch; the context handles all mode logic internally. Settings live in a new Voice tab added to `SettingsSidebar` via an `extraTabs` prop.

**Tech Stack:** React Native, `react-native-tts` (already in project), `KeyboardPreferences` (shared storage bridge), `ButtonGroupRow` (shared UI component)

## Global Constraints

- iOS-first; do not touch Android code
- No commits — developer commits manually
- Do not run Metro or Xcode builds
- Persist settings via `KeyboardPreferences` (not AsyncStorage)
- No new npm packages — `react-native-tts` is already installed
- `CalcTTSContext` must NOT depend on IssieVoice's `TTSContext`
- `SettingsSidebar` change must not break IssieVoice (extraTabs is optional, default undefined)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/issiecalc/src/context/CalcTTSContext.tsx` | **Create** | TTS state, readout logic, persistence |
| `apps/issiecalc/src/components/CalcVoiceSettingsPanel.tsx` | **Create** | Voice settings UI |
| `apps/issiecalc/App.tsx` | **Modify** | Add `CalcTTSProvider` |
| `apps/issiecalc/src/screens/CalcScreen.tsx` | **Modify** | Call `readout()` after key dispatch |
| `apps/issiecalc/src/screens/SettingsScreen.tsx` | **Modify** | Add voice tab + render panel |
| `apps/issievoice/src/components/Settings/SettingsSidebar.tsx` | **Modify** | Add `extraTabs` prop |

---

## Task 1: Create `CalcTTSContext`

**Files:**
- Create: `apps/issiecalc/src/context/CalcTTSContext.tsx`

**Interfaces:**
- Produces: `CalcTTSProvider`, `useCalcTTS()` hook returning `CalcTTSContextValue`

```ts
type ReadoutMode = 'off' | 'every-digit' | 'every-number';

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
```

- [ ] **Step 1: Create the context file**

Create `apps/issiecalc/src/context/CalcTTSContext.tsx` with the full implementation:

```tsx
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

// Keys that never trigger readout
const SILENT_KEYS = new Set(['⌫', 'AC', '+/-', '[2ND]', '[2ND_OFF]', '[ANGLE_TOGGLE]', 'ms', 'mr', 'rand']);

// Operator keys that trigger "every-number" readout
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
  // Number segment after the last operator (or whole expression if none)
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
        if (!isNaN(r)) { rateRef.current = r; setRateState(r); }
      }
      if (pitchStr) {
        const p = parseFloat(pitchStr);
        if (!isNaN(p)) { pitchRef.current = p; setPitchState(p); }
      }
      if (vid) { voiceIdRef.current = vid; setVoiceIdState(vid); }
      if (lang) { languageRef.current = lang; setLanguageState(lang); }
    });

    TTS.initialize();
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
  }, []);

  const setPitch = useCallback((p: number) => {
    pitchRef.current = p;
    setPitchState(p);
    KeyboardPreferences.setString(PITCH_KEY, String(p));
  }, []);

  const setVoice = useCallback((vid: string, lang: string) => {
    voiceIdRef.current = vid;
    languageRef.current = lang;
    setVoiceIdState(vid);
    setLanguageState(lang);
    KeyboardPreferences.setString(VOICE_ID_KEY, vid);
    KeyboardPreferences.setString(LANGUAGE_KEY, lang);
  }, []);

  const speak = useCallback(async (text: string) => {
    try {
      await TTS.setRate(rateRef.current);
      await TTS.setPitch(pitchRef.current);
      if (languageRef.current) await TTS.setLanguage(languageRef.current);
      if (voiceIdRef.current) await TTS.setVoice(voiceIdRef.current);
      await TTS.speak(text);
    } catch {}
  }, []);

  const readout = useCallback((keyValue: string, expression: string, result: string) => {
    const mode = readoutModeRef.current;
    if (mode === 'off') return;
    if (SILENT_KEYS.has(keyValue)) return;

    if (mode === 'every-digit') {
      const text = DIGIT_SUBSTITUTIONS[keyValue] ?? keyValue;
      speak(text);
      return;
    }

    if (mode === 'every-number') {
      if (keyValue === '=') {
        const lastOperand = extractLastOperand(expression.replace(/=$/, '').replace(/[+\-*\/^%][^+\-*\/^%]*$/, m => m));
        // expression at this point already has = handled — use the incoming expression before =
        // result is the computed value
        const operand = extractLastOperand(expression);
        const spoken = result === 'Error' ? 'error' : `${operand} equals ${result}`;
        speak(spoken);
        return;
      }
      if (OPERATOR_KEYS.has(keyValue)) {
        // expression already includes the operator at end, extract before it
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
```

- [ ] **Step 2: Verify no TypeScript errors**

In VS Code or via the IDE diagnostics, confirm `CalcTTSContext.tsx` has no red underlines. The import path `'../../../issievoice/src/services/TextToSpeech'` resolves from `apps/issiecalc/src/context/` → `apps/issievoice/src/services/TextToSpeech.ts`. The import `'../../../../src/native/KeyboardPreferences'` resolves to the shared `src/native/KeyboardPreferences.ts`.

---

## Task 2: Wire `CalcTTSProvider` into App

**Files:**
- Modify: `apps/issiecalc/App.tsx`

**Interfaces:**
- Consumes: `CalcTTSProvider` from `./src/context/CalcTTSContext`

- [ ] **Step 1: Add the provider import and wrap**

Open `apps/issiecalc/App.tsx`. It currently reads:

```tsx
import { CalcProvider } from './src/context/CalcContext';
```

Add after that line:

```tsx
import { CalcTTSProvider } from './src/context/CalcTTSContext';
```

Then in the JSX, wrap `NavigationContainer` with `CalcTTSProvider` inside `CalcProvider`:

```tsx
<CalcProvider>
  <CalcTTSProvider>
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Calc" component={CalcScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  </CalcTTSProvider>
</CalcProvider>
```

---

## Task 3: Wire `readout()` into `CalcScreen`

**Files:**
- Modify: `apps/issiecalc/src/screens/CalcScreen.tsx`

**Interfaces:**
- Consumes: `useCalcTTS()` → `readout(keyValue, expression, result)`
- Note: `expressionRef` and `resultRef` are already available in `CalcScreen` via `useCalc()` — but they're inside `CalcContext`, not exposed directly. `CalcScreen` accesses `expression` and `result` as state values. For `every-number` mode the expression ref matters after operator appending. We pass `expression` (state) and `result` (state) — these are React state so they reflect the value *before* the current render. To get the post-dispatch value, call `readout` using the local `expressionRef.current` and `resultRef.current` — but those are internal to `CalcContext`. Instead, we expose them by reading them from the context value.

> **Important:** `CalcContext` does NOT currently expose `expressionRef` or `resultRef`. For `every-number` operator case, the expression state after `appendToExpression` reflects the new value synchronously via `expressionRef.current` inside the context, but the React state `expression` lags one render. To handle this correctly, we compute the post-append expression locally in `handleKeyPress` before dispatching.

Simplest correct approach: in `handleKeyPress`, for each operator case, compute what the expression will be after append, then pass that to `readout`. For `=`, `computeResult` sets `resultRef.current` synchronously inside CalcContext — but `result` state is async. So for `=`, expose `result` from a ref in `CalcContext`, OR pass the result from `evaluate()` directly.

**Revised approach — expose refs from CalcContext:**

First, add `expressionRef` and `resultRef` to the `CalcContext` value (read-only, just the `.current` values via a getter function). Then pass them through.

Actually the cleanest solution with zero risk: compute expression locally in `handleKeyPress`.

In `CalcScreen.handleKeyPress`, we already know `expression` (current state) and can compute post-append ourselves for the readout call. For `=`, read `result` from the state one render later — but that's too late. Instead, call `evaluate` directly in `CalcScreen` just for readout purposes.

**Final approach (used in this plan):** Import `evaluate` from `../services/Calculator` in `CalcScreen` for readout-only computation, keeping it side-effect free.

- [ ] **Step 1: Add import for `useCalcTTS` and `evaluate`**

In `apps/issiecalc/src/screens/CalcScreen.tsx`, add imports:

```tsx
import { useCalcTTS } from '../context/CalcTTSContext';
import { evaluate } from '../services/Calculator';
```

- [ ] **Step 2: Get `readout` from context and update `handleKeyPress`**

Add inside `CalcScreen` component (after existing `useCalc()` destructuring):

```tsx
const { readout } = useCalcTTS();
```

Replace the entire `handleKeyPress` function with:

```tsx
const handleKeyPress = (event: KeyPressEvent) => {
  const { value } = event.nativeEvent;
  if (value === '⌫') { backspace(); readout(value, expression, result); return; }
  if (value === 'AC') { clearAll(); readout(value, expression, result); return; }
  if (value === '=') {
    computeResult();
    // compute synchronously for readout — same logic as CalcContext.computeResult
    const res = evaluate(expression, angleMode);
    const finalRes = res === '' ? 'Error' : res;
    readout('=', expression, finalRes);
    return;
  }
  if (value === '+/-') { toggleSign(); readout(value, expression, result); return; }
  if (value === '[2ND]') { setKeyset(landscape ? 'scientific_landscape_2nd' : 'scientific_2nd'); readout(value, expression, result); return; }
  if (value === '[2ND_OFF]') { setKeyset('scientific'); readout(value, expression, result); return; }
  if (value === '[ANGLE_TOGGLE]') { toggleAngleMode(); readout(value, expression, result); return; }
  if (value === 'ms') { memoryStore(); readout(value, expression, result); return; }
  if (value === 'mr') { memoryRecall(); readout(value, expression, result); return; }
  if (value === 'rand') { appendToExpression(String(parseFloat(Math.random().toFixed(9)))); readout(value, expression, result); return; }
  if (value && FUNCTION_KEYS.has(value)) {
    const parts = extractTrailingOperand(expression);
    let newExpr: string;
    if (parts) {
      const [before, operand] = parts;
      newExpr = `${before}${value}${operand})`;
      replaceExpression(newExpr);
    } else {
      newExpr = expression + value;
      appendToExpression(value);
    }
    readout(value, newExpr, result);
    return;
  }
  if (value) {
    const newExpr = resultMode ? (isOperatorOrFunction(value) ? result + value : value) : expression + value;
    appendToExpression(value);
    readout(value, newExpr, result);
  }
};
```

Note: `isOperatorOrFunction` is already defined in `CalcScreen.tsx` — wait, it's defined in `CalcContext.tsx`. We need it in `CalcScreen` now. Extract it or inline the logic.

Add this helper at the top of `CalcScreen.tsx` (after imports):

```tsx
const OPERATORS_RE = /^[+\-*/^%]$/;
const FUNCTIONS_RE = /^(sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|sinh\(|cosh\(|tanh\(|asinh\(|acosh\(|atanh\(|sqrt\(|ln\(|log\(|log2\(|logy\(|2root\(|3root\(|yroot\(|factorial\(|x\^2|x\^3|x\^\(|\^\(|2\^\(|1\/\(|\(|\)|pi|e)$/;

function isOpOrFn(val: string): boolean {
  return OPERATORS_RE.test(val) || FUNCTIONS_RE.test(val);
}
```

Then use `isOpOrFn` in the revised `handleKeyPress` for the `rand`-fallback branch:

```tsx
const newExpr = resultMode ? (isOpOrFn(value) ? result + value : value) : expression + value;
```

---

## Task 4: Add `extraTabs` to `SettingsSidebar`

**Files:**
- Modify: `apps/issievoice/src/components/Settings/SettingsSidebar.tsx`

**Interfaces:**
- Produces: `extraTabs` prop on `SettingsSidebarProps`

```ts
extraTabs?: Array<{
  id: string;
  label: string;
  iconName: string;
  iconType: IconType;
  iconColor: string;
}>;
```

- [ ] **Step 1: Add `extraTabs` to `SettingsSidebarProps`**

In `SettingsSidebarProps` interface, add:

```ts
extraTabs?: Array<{
  id: string;
  label: string;
  iconName: string;
  iconType: IconType;
  iconColor: string;
}>;
```

- [ ] **Step 2: Destructure and pass through**

In `SettingsSidebar` component signature, add `extraTabs` to destructuring:

```tsx
const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
  isLandscape,
  disabledTabs,
  hiddenTabs,
  mode = 'voice',
  kbLanguage = 'he',
  onAbout,
  extraTabs,   // ← add this
}) => {
```

- [ ] **Step 3: Render `extraTabs` in landscape sidebar**

In the landscape return block, after the keyboard children `{KEYBOARD_CHILDREN.map(...)}` and before the `{!keyboardOnly && ...}` voice/language block, add:

```tsx
{/* Extra tabs (e.g. IssieCalc voice tab) */}
{extraTabs && extraTabs.length > 0 && (
  <>
    <View style={styles.divider} />
    {extraTabs.map(tab => (
      <TabItem
        key={tab.id}
        tab={tab}
        isActive={activeTab === tab.id}
        onPress={() => onTabChange(tab.id)}
        compact={isPhone}
        extraCompact={isPhoneVoice}
        isRTL={isRTL}
      />
    ))}
  </>
)}
```

- [ ] **Step 4: Render `extraTabs` in portrait keyboard-only mode**

In the portrait `keyboardOnly` return block, inside the `<View style={styles.subTabRow}>`, after the `{KEYBOARD_CHILDREN.map(...)}` block and before the About button block, add:

```tsx
{extraTabs && extraTabs.map(tab => (
  <TouchableOpacity
    key={tab.id}
    style={[isPhone ? styles.subTabIconOnly : styles.subTab, activeTab === tab.id && styles.subTabActive]}
    onPress={() => onTabChange(tab.id)}
    activeOpacity={0.7}>
    <View
      style={[
        styles.iconCircleTiny,
        { backgroundColor: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : tab.iconColor + '18' },
      ]}>
      <MyIcon
        info={{
          name: tab.iconName,
          type: tab.iconType,
          color: activeTab === tab.id ? '#FFFFFF' : tab.iconColor,
          size: 16,
        }}
      />
    </View>
    {!isPhone && (
      <Text
        allowFontScaling={false}
        style={[styles.subTabText, activeTab === tab.id && styles.subTabTextActive]}>
        {tab.label}
      </Text>
    )}
  </TouchableOpacity>
))}
```

---

## Task 5: Create `CalcVoiceSettingsPanel`

**Files:**
- Create: `apps/issiecalc/src/components/CalcVoiceSettingsPanel.tsx`

**Interfaces:**
- Consumes: `useCalcTTS()` from `../context/CalcTTSContext`
- Consumes: `ButtonGroupRow` from `../../../../src/components/shared/ButtonGroupRow`
- Consumes: `TTS` from `../../../issievoice/src/services/TextToSpeech`

- [ ] **Step 1: Create the component**

Create `apps/issiecalc/src/components/CalcVoiceSettingsPanel.tsx`:

```tsx
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
  const { readoutMode, rate, pitch, voiceId, setReadoutMode, setRate, setPitch, setVoice } = useCalcTTS();
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

  // Group voices by language prefix for display
  const groupedVoices: { lang: string; voices: Voice[] }[] = [];
  voices.forEach(v => {
    const lang = v.language.split('-')[0];
    const group = groupedVoices.find(g => g.lang === lang);
    if (group) group.voices.push(v);
    else groupedVoices.push({ lang, voices: [v] });
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Readout mode */}
      <ButtonGroupRow
        title="Readout"
        options={readoutOptions}
        selectedId={readoutMode}
        onSelect={id => setReadoutMode(id as any)}
      />

      {readoutMode !== 'off' && (
        <>
          <View style={styles.separator} />

          {/* Speed */}
          <ButtonGroupRow
            title="Speed"
            options={rateOptions}
            selectedId={currentRateId}
            onSelect={handleRateChange}
          />
          <View style={styles.separator} />

          {/* Pitch */}
          <ButtonGroupRow
            title="Pitch"
            options={pitchOptions}
            selectedId={currentPitchId}
            onSelect={handlePitchChange}
          />
          <View style={styles.separator} />

          {/* Voice picker */}
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
```

---

## Task 6: Wire voice tab into `SettingsScreen`

**Files:**
- Modify: `apps/issiecalc/src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `CalcVoiceSettingsPanel` from `../components/CalcVoiceSettingsPanel`
- Consumes: `extraTabs` prop on `SettingsSidebar`

- [ ] **Step 1: Add import**

In `apps/issiecalc/src/screens/SettingsScreen.tsx`, add:

```tsx
import CalcVoiceSettingsPanel from '../components/CalcVoiceSettingsPanel';
```

- [ ] **Step 2: Define the extra tab**

Inside the `SettingsScreen` component body, add:

```tsx
const VOICE_EXTRA_TAB = {
  id: 'voice',
  label: 'Voice',
  iconName: 'volume-high-outline',
  iconType: 'Ionicons' as const,
  iconColor: '#D97706',
};
```

- [ ] **Step 3: Pass `extraTabs` to both `SettingsSidebar` instances**

Both the landscape and portrait `SettingsSidebar` calls need `extraTabs={[VOICE_EXTRA_TAB]}`:

```tsx
<SettingsSidebar
  activeTab={activeTab}
  onTabChange={handleTabChange}
  isLandscape         // or isLandscape={false}
  hiddenTabs={['nikkud', 'features']}
  mode="keyboard"
  kbLanguage="en"
  extraTabs={[VOICE_EXTRA_TAB]}
/>
```

- [ ] **Step 4: Render `CalcVoiceSettingsPanel` when voice tab is active**

Replace the `renderContent` function with:

```tsx
const renderContent = () => {
  if (activeTab === 'voice') {
    return <CalcVoiceSettingsPanel />;
  }
  return (
    <EditorScreen
      appContext="issiecalc"
      initialLanguage="calc"
      onClose={handleClose}
      onStateChange={({ profileName: name, isDirty: dirty }) => {
        setProfileName(name);
        setIsDirty(dirty);
      }}
      headless
      activeTab={activeTab}
      saveRef={saveRef}
      autoSaveRef={autoSaveRef}
      discardRef={discardRef}
      showProfilePickerRef={showProfilePickerRef}
    />
  );
};
```

---

## Self-Review

**Spec coverage:**
- ✅ `CalcTTSContext` with all 5 persistence keys — Task 1
- ✅ `every-digit` mode with substitution table — Task 1
- ✅ `every-number` mode: operator → "[number] [op]", `=` → "[operand] equals [result]" — Task 1 + Task 3
- ✅ Language set before speak, no auto-detect — Task 1
- ✅ `CalcTTSProvider` in App.tsx — Task 2
- ✅ `readout()` called in `handleKeyPress` — Task 3
- ✅ `extraTabs` prop on `SettingsSidebar` — Task 4
- ✅ `CalcVoiceSettingsPanel` with readout/speed/pitch/voice — Task 5
- ✅ Conditional display when mode != off — Task 5
- ✅ Full device voice list grouped by language — Task 5
- ✅ Voice tab wired in `SettingsScreen` — Task 6
- ✅ Silent keys (⌫, AC, +/-, [2ND], etc.) — Task 1

**Placeholders:** None.

**Type consistency:** `ReadoutMode` exported from Task 1 and used consistently. `CalcTTSContextValue` interface defined once in Task 1, consumed in Tasks 5 and 6 via `useCalcTTS()`. `extraTabs` prop type defined in Task 4 and consumed in Task 6. `isOpOrFn` helper added in Task 3 co-located with `CalcScreen`.
