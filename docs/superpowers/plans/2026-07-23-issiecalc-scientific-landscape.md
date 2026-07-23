# IssieCalc Scientific Landscape Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current scientific_landscape keyset with a full Apple-Calculator-style 5-row × 10-key layout, add a `2nd` toggle keyset, Rad/Deg state, memory (ms/mr), and all the new math functions.

**Architecture:** Two new keysets in `calc.json` (`scientific_landscape` and `scientific_landscape_2nd`). `CalcContext` gains `angleMode` and `memory` state. `CalcScreen` patches the `[ANGLE_TOGGLE]` key caption at runtime and routes new sentinels. `Calculator.ts` gains an `angleMode` param and inline JS `Math` substitution for functions unsupported by `advanced-calculator`.

**Tech Stack:** React Native (TypeScript), `keyboards/calc.json`, `advanced-calculator` npm package (shunting-yard evaluator supporting `sin/cos/tan/ln/log/sqrt/^`).

## Global Constraints

- iOS-first; no Android changes in this plan.
- Do not run `npm run build:keyboards` manually — developer rebuilds from Xcode/Metro.
- `calc.json` is the source of truth for key layout; `ios/IssieCalc/default_config.json` is the built output (rebuilt by the build script, but for this feature we edit `calc.json` and the build script generates the output — see Task 1 note).
- Key `value` strings are emitted verbatim by the native keyboard to `handleKeyPress`.
- `advanced-calculator`'s `evaluate` uses radians; does not support `sinh/cosh/tanh/asin/acos/atan/asinh/acosh/atanh/factorial/log2`.
- `ln(x)` is supported by `advanced-calculator` natively (maps to `Math.log`).
- `log(x)` in `advanced-calculator` maps to `Math.log10`.
- No commits without developer request.
- `calcBuiltInProfiles.ts` `OPERATOR_KEYS` list needs updating for new function keys to get correct styling.

---

## File Map

| File | Change |
|------|--------|
| `keyboards/calc.json` | Replace `scientific_landscape`; add `scientific_landscape_2nd` |
| `apps/issiecalc/src/services/Calculator.ts` | Add `angleMode` param, inline Math substitutions for new functions |
| `apps/issiecalc/src/context/CalcContext.tsx` | Add `angleMode`, `memory`, `toggleAngleMode`, `memoryStore`, `memoryRecall` |
| `apps/issiecalc/src/screens/CalcScreen.tsx` | New sentinel routing, angle-mode label patch, keyset selection update |
| `src/data/calcBuiltInProfiles.ts` | Add new function keys to `OPERATOR_KEYS` for correct theme styling |

---

## Task 1: Replace `scientific_landscape` and add `scientific_landscape_2nd` in `calc.json`

**Files:**
- Modify: `keyboards/calc.json`

**Interfaces:**
- Produces: keyset ids `scientific_landscape` and `scientific_landscape_2nd` consumed by `CalcScreen`

**Note:** `keyboards/calc.json` is the source. The build script copies keysets into `ios/IssieCalc/default_config.json`. After editing `calc.json`, run:
```bash
node scripts/build_keyboard_configs.js
```
This regenerates `ios/IssieCalc/default_config.json` (and the Android equivalent). Verify the new keysets appear in the output file.

- [ ] **Step 1: Replace the `scientific_landscape` keyset in `keyboards/calc.json`**

Find the existing `"id": "scientific_landscape"` keyset object and replace it entirely with:

```json
{
  "id": "scientific_landscape",
  "rows": [
    {
      "keys": [
        { "value": "(" },
        { "value": ")" },
        { "value": "ms", "caption": "ms" },
        { "value": "mr", "caption": "mr" },
        { "value": "⌫", "caption": "⌫" },
        { "value": "AC" },
        { "value": "%" },
        { "value": "/", "caption": "÷" }
      ]
    },
    {
      "keys": [
        { "value": "[2ND]", "caption": "2nd" },
        { "value": "x^2", "caption": "x²" },
        { "value": "x^3", "caption": "x³" },
        { "value": "x^(", "caption": "xʸ" },
        { "value": "^(", "caption": "yˣ" },
        { "value": "2^(", "caption": "2ˣ" },
        { "value": "7" },
        { "value": "8" },
        { "value": "9" },
        { "value": "*", "caption": "×", "fontSizePreset": "small" }
      ]
    },
    {
      "keys": [
        { "value": "1/(", "caption": "¹/ₓ" },
        { "value": "2root(", "caption": "²√x" },
        { "value": "3root(", "caption": "³√x" },
        { "value": "yroot(", "caption": "ʸ√x" },
        { "value": "logy(", "caption": "logᵧ" },
        { "value": "log2(", "caption": "log₂" },
        { "value": "4" },
        { "value": "5" },
        { "value": "6" },
        { "value": "-" }
      ]
    },
    {
      "keys": [
        { "value": "factorial(", "caption": "x!" },
        { "value": "sin(", "caption": "sin" },
        { "value": "cos(", "caption": "cos" },
        { "value": "tan(", "caption": "tan" },
        { "value": "e" },
        { "value": "ln(", "caption": "ln" },
        { "value": "1" },
        { "value": "2" },
        { "value": "3" },
        { "value": "+" }
      ]
    },
    {
      "keys": [
        { "value": "rand", "caption": "Rand" },
        { "value": "sinh(", "caption": "sinh" },
        { "value": "cosh(", "caption": "cosh" },
        { "value": "tanh(", "caption": "tanh" },
        { "value": "pi", "caption": "π" },
        { "value": "[ANGLE_TOGGLE]", "caption": "Rad" },
        { "value": "+/-" },
        { "value": "0" },
        { "value": "." },
        { "value": "=", "caption": "=" }
      ]
    }
  ]
}
```

- [ ] **Step 2: Add `scientific_landscape_2nd` keyset after `scientific_landscape`**

Insert the following new keyset object into the `keysets` array, after `scientific_landscape`:

```json
{
  "id": "scientific_landscape_2nd",
  "rows": [
    {
      "keys": [
        { "value": "(" },
        { "value": ")" },
        { "value": "ms", "caption": "ms" },
        { "value": "mr", "caption": "mr" },
        { "value": "⌫", "caption": "⌫" },
        { "value": "AC" },
        { "value": "%" },
        { "value": "/", "caption": "÷" }
      ]
    },
    {
      "keys": [
        { "value": "[2ND_OFF]", "caption": "2nd" },
        { "value": "x^2", "caption": "x²" },
        { "value": "x^3", "caption": "x³" },
        { "value": "x^(", "caption": "xʸ" },
        { "value": "^(", "caption": "yˣ" },
        { "value": "2^(", "caption": "2ˣ" },
        { "value": "7" },
        { "value": "8" },
        { "value": "9" },
        { "value": "*", "caption": "×", "fontSizePreset": "small" }
      ]
    },
    {
      "keys": [
        { "value": "1/(", "caption": "¹/ₓ" },
        { "value": "2root(", "caption": "²√x" },
        { "value": "3root(", "caption": "³√x" },
        { "value": "yroot(", "caption": "ʸ√x" },
        { "value": "logy(", "caption": "logᵧ" },
        { "value": "log2(", "caption": "log₂" },
        { "value": "4" },
        { "value": "5" },
        { "value": "6" },
        { "value": "-" }
      ]
    },
    {
      "keys": [
        { "value": "factorial(", "caption": "x!" },
        { "value": "asin(", "caption": "sin⁻¹" },
        { "value": "acos(", "caption": "cos⁻¹" },
        { "value": "atan(", "caption": "tan⁻¹" },
        { "value": "e^(", "caption": "eˣ" },
        { "value": "ln(", "caption": "ln" },
        { "value": "1" },
        { "value": "2" },
        { "value": "3" },
        { "value": "+" }
      ]
    },
    {
      "keys": [
        { "value": "rand", "caption": "Rand" },
        { "value": "asinh(", "caption": "sinh⁻¹" },
        { "value": "acosh(", "caption": "cosh⁻¹" },
        { "value": "atanh(", "caption": "tanh⁻¹" },
        { "value": "pi", "caption": "π" },
        { "value": "[ANGLE_TOGGLE]", "caption": "Rad" },
        { "value": "+/-" },
        { "value": "0" },
        { "value": "." },
        { "value": "=", "caption": "=" }
      ]
    }
  ]
}
```

- [ ] **Step 3: Run the keyboard config build script**

```bash
cd /Users/i022021/dev/Issie/IssieBoardNG
node scripts/build_keyboard_configs.js
```

Expected: no errors, `ios/IssieCalc/default_config.json` updated.

- [ ] **Step 4: Verify the output**

```bash
node -e "
const c = require('./ios/IssieCalc/default_config.json');
const ids = c.keysets.map(k => k.id);
console.log(ids);
const sci2 = c.keysets.find(k => k.id === 'scientific_landscape_2nd');
console.log('row4 keys:', sci2.rows[3].keys.map(k => k.value));
"
```

Expected output includes `scientific_landscape` and `scientific_landscape_2nd` in the ids array. Row 4 of `_2nd` should show `['factorial(', 'asin(', 'acos(', 'atan(', 'e^(', 'ln(', '1', '2', '3', '+']`.

---

## Task 2: Expand `Calculator.ts` with new functions and `angleMode`

**Files:**
- Modify: `apps/issiecalc/src/services/Calculator.ts`

**Interfaces:**
- Consumes: nothing new from other tasks
- Produces: `evaluate(expression: string, angleMode?: 'rad' | 'deg'): string` — signature change consumed by Task 3

- [ ] **Step 1: Replace `Calculator.ts` entirely with the new implementation**

```typescript
import { evaluate as acEvaluate } from 'advanced-calculator';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// Substitute a single-arg function call with its numeric result.
// Matches func( <non-nested content> ) — no nested parens inside.
function substituteFunc(
  expr: string,
  name: string,
  fn: (x: number) => number
): string {
  const re = new RegExp(`${name}\\(([^()]+)\\)`, 'g');
  return expr.replace(re, (_, inner) => {
    const val = Number(inner);
    if (isNaN(val)) return 'NaN';
    const result = fn(val);
    if (!isFinite(result) || isNaN(result)) return 'NaN';
    return String(result);
  });
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function normalize(expression: string, angleMode: 'rad' | 'deg'): string {
  let e = expression;

  // Display glyphs → operators
  e = e.replace(/×/g, '*').replace(/÷/g, '/');

  // Constants — replace bare `e` (not followed by ^) before other substitutions
  e = e.replace(/\bpi\b/g, String(Math.PI));
  e = e.replace(/\be(?!\^)/g, String(Math.E));

  // x^2, x^3 shorthand captions — already use ^ so acEvaluate handles them
  // (no substitution needed)

  // Inline Math substitutions — these functions are not in acEvaluate
  // Apply iteratively until stable (handles one level of nesting at a time)
  const mathFuncs: Array<[string, (x: number) => number]> = [
    ['factorial', factorial],
    ['2root', (x) => Math.sqrt(x)],
    ['3root', (x) => Math.cbrt(x)],
    ['log2', (x) => Math.log2(x)],
    ['sinh', (x) => Math.sinh(x)],
    ['cosh', (x) => Math.cosh(x)],
    ['tanh', (x) => Math.tanh(x)],
    ['asinh', (x) => Math.asinh(x)],
    ['acosh', (x) => Math.acosh(x)],
    ['atanh', (x) => Math.atanh(x)],
    ['asin', angleMode === 'deg' ? (x) => Math.asin(x) * RAD_TO_DEG : (x) => Math.asin(x)],
    ['acos', angleMode === 'deg' ? (x) => Math.acos(x) * RAD_TO_DEG : (x) => Math.acos(x)],
    ['atan', angleMode === 'deg' ? (x) => Math.atan(x) * RAD_TO_DEG : (x) => Math.atan(x)],
  ];

  for (let iter = 0; iter < 10; iter++) {
    const prev = e;
    for (const [name, fn] of mathFuncs) {
      e = substituteFunc(e, name, fn);
    }
    if (e === prev) break;
  }

  // Deg mode: wrap sin/cos/tan args with deg→rad conversion
  if (angleMode === 'deg') {
    e = e.replace(/\bsin\(([^()]+)\)/g, (_, x) => `sin(${x}*${DEG_TO_RAD})`);
    e = e.replace(/\bcos\(([^()]+)\)/g, (_, x) => `cos(${x}*${DEG_TO_RAD})`);
    e = e.replace(/\btan\(([^()]+)\)/g, (_, x) => `tan(${x}*${DEG_TO_RAD})`);
  }

  // % operator
  e = e.replace(/%/g, '/100');

  return e;
}

function isIncomplete(expression: string): boolean {
  const trimmed = expression.trim();
  if (!trimmed) return true;
  return /[+\-*/^(]$/.test(trimmed);
}

export function evaluate(expression: string, angleMode: 'rad' | 'deg' = 'rad'): string {
  if (!expression || expression.trim() === '') return '0';
  if (isIncomplete(expression)) return '';
  try {
    const normalized = normalize(expression, angleMode);
    if (normalized.includes('NaN')) return 'Error';
    const result = acEvaluate(normalized);
    if (result === 'Invalid input' || result === undefined || result === null) return 'Error';
    if (result === Infinity || result === -Infinity) return 'Error';
    if (typeof result === 'number' && isNaN(result)) return 'Error';
    const rounded = parseFloat(Number(result).toPrecision(12));
    return String(rounded);
  } catch {
    return 'Error';
  }
}

export function negateLastNumber(expression: string): string {
  const match = expression.match(/(-?\d+\.?\d*)$/);
  if (!match) return expression;
  const num = match[1];
  const before = expression.slice(0, expression.length - num.length);
  if (!before.trim()) {
    return num.startsWith('-') ? num.slice(1) : '-' + num;
  }
  return `${before}(-${num})`;
}
```

- [ ] **Step 2: Manually verify key cases in the Metro console or a quick Node test**

```bash
node -e "
// Quick smoke test (no TypeScript, just logic port)
const Math2 = Math;
const DEG_TO_RAD = Math.PI / 180;

function substituteFunc(expr, name, fn) {
  const re = new RegExp(name + '\\\\(([^()]+)\\\\)', 'g');
  return expr.replace(re, (_, inner) => {
    const val = Number(inner);
    if (isNaN(val)) return 'NaN';
    const result = fn(val);
    return (!isFinite(result) || isNaN(result)) ? 'NaN' : String(result);
  });
}

let e = 'asin(1)';
e = substituteFunc(e, 'asin', x => Math.asin(x));
console.log('asin(1) =>', e); // 1.5707963...

let e2 = 'factorial(5)';
function factorial(n) { if (!Number.isInteger(n) || n<0) return NaN; let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
e2 = substituteFunc(e2, 'factorial', factorial);
console.log('factorial(5) =>', e2); // 120

let e3 = 'sin(90)';
e3 = e3.replace(/\\bsin\\(([^()]+)\\)/g, (_, x) => 'sin(' + x + '*' + DEG_TO_RAD + ')');
console.log('sin(90) deg wrapped =>', e3); // sin(90*0.01745...)
"
```

Expected: `asin(1) => 1.5707963267948966`, `factorial(5) => 120`, `sin(90) deg wrapped => sin(90*0.017453292519943295)`.

---

## Task 3: Update `CalcContext` — add `angleMode`, `memory`, new actions

**Files:**
- Modify: `apps/issiecalc/src/context/CalcContext.tsx`

**Interfaces:**
- Consumes: `evaluate(expr, angleMode)` from Task 2
- Produces:
  - `angleMode: 'rad' | 'deg'`
  - `toggleAngleMode(): void`
  - `memory: string`
  - `memoryStore(): void`
  - `memoryRecall(): void`
  - `Keyset` type now includes `'scientific_landscape_2nd'`

- [ ] **Step 1: Replace `CalcContext.tsx` entirely**

```typescript
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { evaluate, negateLastNumber } from '../services/Calculator';

type Keyset = 'basic' | 'scientific' | 'scientific_landscape_2nd';
type AngleMode = 'rad' | 'deg';

interface CalcContextValue {
  expression: string;
  result: string;
  resultMode: boolean;
  keyset: Keyset;
  angleMode: AngleMode;
  memory: string;
  appendToExpression: (val: string) => void;
  clearAll: () => void;
  backspace: () => void;
  computeResult: () => void;
  toggleSign: () => void;
  setKeyset: (k: Keyset) => void;
  toggleAngleMode: () => void;
  memoryStore: () => void;
  memoryRecall: () => void;
}

const CalcContext = createContext<CalcContextValue | null>(null);

const OPERATORS = /^[+\-*/^%]$/;
const FUNCTIONS = /^(sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|sinh\(|cosh\(|tanh\(|asinh\(|acosh\(|atanh\(|sqrt\(|ln\(|log\(|log2\(|logy\(|2root\(|3root\(|yroot\(|factorial\(|x\^2|x\^3|x\^\(|\^\(|2\^\(|1\/\(|\(|\)|pi|e)$/;

function isOperatorOrFunction(val: string): boolean {
  return OPERATORS.test(val) || FUNCTIONS.test(val);
}

export const CalcProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [resultMode, setResultMode] = useState(false);
  const [keyset, setKeyset] = useState<Keyset>('basic');
  const [angleMode, setAngleMode] = useState<AngleMode>('rad');
  const [memory, setMemory] = useState('0');

  const expressionRef = useRef('');
  const resultRef = useRef('');
  const resultModeRef = useRef(false);
  const angleModeRef = useRef<AngleMode>('rad');
  const memoryRef = useRef('0');

  const appendToExpression = useCallback((val: string) => {
    if (resultModeRef.current) {
      if (isOperatorOrFunction(val)) {
        expressionRef.current = resultRef.current + val;
      } else {
        expressionRef.current = val;
      }
      resultModeRef.current = false;
      setResultMode(false);
      setResult('');
      resultRef.current = '';
    } else {
      expressionRef.current = expressionRef.current + val;
    }
    setExpression(expressionRef.current);
  }, []);

  const clearAll = useCallback(() => {
    expressionRef.current = '';
    resultRef.current = '';
    resultModeRef.current = false;
    setExpression('');
    setResult('');
    setResultMode(false);
  }, []);

  const backspace = useCallback(() => {
    if (resultModeRef.current) {
      expressionRef.current = '';
      resultRef.current = '';
      resultModeRef.current = false;
      setExpression('');
      setResult('');
      setResultMode(false);
      return;
    }
    expressionRef.current = expressionRef.current.slice(0, -1);
    setExpression(expressionRef.current);
  }, []);

  const computeResult = useCallback(() => {
    const res = evaluate(expressionRef.current, angleModeRef.current);
    const finalRes = res === '' ? 'Error' : res;
    resultRef.current = finalRes;
    resultModeRef.current = true;
    setResult(finalRes);
    setResultMode(true);
  }, []);

  const toggleSign = useCallback(() => {
    if (resultModeRef.current) {
      const negated = negateLastNumber(resultRef.current);
      expressionRef.current = negated;
      resultRef.current = '';
      resultModeRef.current = false;
      setExpression(negated);
      setResult('');
      setResultMode(false);
      return;
    }
    expressionRef.current = negateLastNumber(expressionRef.current);
    setExpression(expressionRef.current);
  }, []);

  const toggleAngleMode = useCallback(() => {
    const next: AngleMode = angleModeRef.current === 'rad' ? 'deg' : 'rad';
    angleModeRef.current = next;
    setAngleMode(next);
  }, []);

  const memoryStore = useCallback(() => {
    const val = resultModeRef.current ? resultRef.current : expressionRef.current;
    if (val && val !== 'Error') {
      memoryRef.current = val;
      setMemory(val);
    }
  }, []);

  const memoryRecall = useCallback(() => {
    if (memoryRef.current !== '0' || expressionRef.current === '') {
      appendToExpression(memoryRef.current);
    }
  }, [appendToExpression]);

  return (
    <CalcContext.Provider value={{
      expression, result, resultMode, keyset, angleMode, memory,
      appendToExpression, clearAll, backspace, computeResult, toggleSign,
      setKeyset, toggleAngleMode, memoryStore, memoryRecall,
    }}>
      {children}
    </CalcContext.Provider>
  );
};

export function useCalc(): CalcContextValue {
  const ctx = useContext(CalcContext);
  if (!ctx) throw new Error('useCalc must be used inside CalcProvider');
  return ctx;
}
```

- [ ] **Step 2: Check TypeScript compiles (Metro will surface errors on next launch)**

```bash
cd /Users/i022021/dev/Issie/IssieBoardNG
npx tsc --noEmit --project tsconfig.json 2>&1 | grep -E "CalcContext|Calculator|error" | head -20
```

Expected: no errors mentioning CalcContext or Calculator.

---

## Task 4: Update `CalcScreen` — new sentinels, angle-mode label patch, keyset mapping

**Files:**
- Modify: `apps/issiecalc/src/screens/CalcScreen.tsx`

**Interfaces:**
- Consumes: `angleMode`, `toggleAngleMode`, `memoryStore`, `memoryRecall`, `setKeyset('scientific_landscape_2nd')` from Task 3
- Consumes: keyset ids `scientific_landscape`, `scientific_landscape_2nd` from Task 1

- [ ] **Step 1: Update `CalcScreen.tsx`**

Replace the full file:

```typescript
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { KeyboardPreview, KeyPressEvent } from '../../../../src/components/KeyboardPreview';
import { useCalc } from '../context/CalcContext';
import KeyboardPreferences from '../../../../src/native/KeyboardPreferences';

const builtConfig = require('../../../../ios/IssieCalc/default_config.json');

const KB_BG = '#000000';

function formatExpression(expr: string): string {
  return expr.replace(/\*/g, '×').replace(/\//g, '÷');
}

function isLandscape() {
  const { width, height } = Dimensions.get('window');
  return width > height;
}

function patchAngleToggleCaption(config: any, caption: string): any {
  return {
    ...config,
    keysets: config.keysets.map((ks: any) => ({
      ...ks,
      rows: ks.rows.map((row: any) => ({
        ...row,
        keys: row.keys.map((key: any) =>
          key.value === '[ANGLE_TOGGLE]' ? { ...key, caption } : key
        ),
      })),
    })),
  };
}

interface CalcScreenProps {
  navigation?: any;
}

const CalcScreen: React.FC<CalcScreenProps> = ({ navigation }) => {
  const {
    expression, result, resultMode,
    appendToExpression, clearAll, backspace, computeResult, toggleSign,
    keyset, setKeyset,
    angleMode, toggleAngleMode,
    memoryStore, memoryRecall,
  } = useCalc();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(500);
  const [landscape, setLandscape] = useState(isLandscape());
  const [liveConfig, setLiveConfig] = useState<any>(builtConfig);

  useFocusEffect(useCallback(() => {
    KeyboardPreferences.getString('keyboardConfig_issiecalc_calc').then(saved => {
      if (saved) {
        try { setLiveConfig(JSON.parse(saved)); } catch {}
      } else {
        setLiveConfig(builtConfig);
      }
    });
  }));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => {
      setLandscape(isLandscape());
    });
    return () => sub?.remove();
  }, []);

  const configJson = useMemo(() => {
    let defaultKeyset: string;
    if (keyset === 'scientific_landscape_2nd') {
      defaultKeyset = 'scientific_landscape_2nd';
    } else if (keyset === 'scientific') {
      defaultKeyset = landscape ? 'scientific_landscape' : 'scientific';
    } else {
      defaultKeyset = landscape ? 'basic_landscape' : 'basic';
    }

    const angleCaption = angleMode === 'rad' ? 'Rad' : 'Deg';
    const patched = patchAngleToggleCaption(liveConfig, angleCaption);
    return JSON.stringify({ ...patched, defaultKeyset });
  }, [keyset, landscape, liveConfig, angleMode]);

  const handleKeyPress = (event: KeyPressEvent) => {
    const { value } = event.nativeEvent;
    if (value === '⌫') { backspace(); return; }
    if (value === 'AC') { clearAll(); return; }
    if (value === '=') { computeResult(); return; }
    if (value === '+/-') { toggleSign(); return; }
    if (value === '[2ND]') { setKeyset('scientific_landscape_2nd'); return; }
    if (value === '[2ND_OFF]') { setKeyset('scientific'); return; }
    if (value === '[ANGLE_TOGGLE]') { toggleAngleMode(); return; }
    if (value === 'ms') { memoryStore(); return; }
    if (value === 'mr') { memoryRecall(); return; }
    if (value === 'rand') { appendToExpression(String(parseFloat(Math.random().toFixed(9)))); return; }
    if (value) appendToExpression(value);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segment, keyset === 'basic' && styles.segmentActive]}
            onPress={() => setKeyset('basic')}>
            <Text style={[styles.segmentText, keyset === 'basic' && styles.segmentTextActive]}>Basic</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, (keyset === 'scientific' || keyset === 'scientific_landscape_2nd') && styles.segmentActive]}
            onPress={() => setKeyset('scientific')}>
            <Text style={[styles.segmentText, (keyset === 'scientific' || keyset === 'scientific_landscape_2nd') && styles.segmentTextActive]}>Scientific</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.gearButton} onPress={() => navigation?.navigate('Settings')}>
          <Text style={styles.gearIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Display */}
      <View style={styles.display}>
        {resultMode ? (
          <>
            <Text style={styles.expression} numberOfLines={1} adjustsFontSizeToFit>
              {formatExpression(expression)}
            </Text>
            <Text style={styles.result} numberOfLines={1} adjustsFontSizeToFit>
              {result}
            </Text>
          </>
        ) : (
          <Text style={styles.result} numberOfLines={1} adjustsFontSizeToFit>
            {formatExpression(expression) || '0'}
          </Text>
        )}
      </View>

      {/* Keyboard */}
      <View style={styles.keyboardContainer}>
        <KeyboardPreview
          style={{ height: keyboardHeight, backgroundColor: KB_BG }}
          configJson={configJson}
          hideGlobeButton
          onKeyPress={handleKeyPress}
          onHeightChange={e => setKeyboardHeight(e.nativeEvent.height)}
        />
        <View style={{ height: insets.bottom, backgroundColor: KB_BG }} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  segmented: {
    flex: 1, flexDirection: 'row',
    backgroundColor: '#1C1C1E', borderRadius: 8, padding: 2,
  },
  segment: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  segmentActive: { backgroundColor: '#636366' },
  segmentText: { color: '#8E8E93', fontSize: 14, fontWeight: '500' },
  segmentTextActive: { color: '#FFFFFF' },
  gearButton: { marginLeft: 12, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  gearIcon: { fontSize: 22, color: '#8E8E93' },
  display: {
    flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end',
    paddingHorizontal: 24, paddingBottom: 16,
  },
  expression: { fontSize: 28, color: '#8E8E93', marginBottom: 8, textAlign: 'left', alignSelf: 'stretch' },
  result: { fontSize: 64, fontWeight: '300', color: '#FFFFFF' },
  keyboardContainer: { backgroundColor: KB_BG },
});

export default CalcScreen;
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | grep -E "CalcScreen|error" | head -20
```

Expected: no errors.

---

## Task 5: Update `calcBuiltInProfiles.ts` — add new function keys to `OPERATOR_KEYS`

**Files:**
- Modify: `src/data/calcBuiltInProfiles.ts`

**Interfaces:**
- Produces: updated `OPERATOR_KEYS` constant used by built-in themes to style new keys consistently

- [ ] **Step 1: Replace the `OPERATOR_KEYS` constant**

Find:
```typescript
const OPERATOR_KEYS = ['⌫', 'AC', '%', '/', '*', '-', '+', '=', '(', ')', 'x^2', 'sin(', 'cos(', 'tan(', 'sqrt(', 'log('];
```

Replace with:
```typescript
const OPERATOR_KEYS = [
  '⌫', 'AC', '%', '/', '*', '-', '+', '=', '(', ')',
  'x^2', 'x^3', 'x^(', '^(', '2^(', '1/(',
  'sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(',
  'sinh(', 'cosh(', 'tanh(', 'asinh(', 'acosh(', 'atanh(',
  'sqrt(', 'log(', 'ln(', 'log2(', 'logy(', '2root(', '3root(', 'yroot(',
  'factorial(', '[2ND]', '[2ND_OFF]', '[ANGLE_TOGGLE]', 'ms', 'mr', 'rand', 'e^(',
];
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | grep -E "calcBuiltIn|error" | head -10
```

Expected: no errors.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `scientific_landscape` keyset — Task 1
- ✅ `scientific_landscape_2nd` keyset — Task 1
- ✅ `[2ND]` / `[2ND_OFF]` sentinel routing — Task 4
- ✅ `[ANGLE_TOGGLE]` sentinel + runtime caption patch — Task 4
- ✅ `angleMode` state in CalcContext — Task 3
- ✅ `memory` (ms/mr) — Tasks 3 & 4
- ✅ `rand` key — Tasks 3 & 4
- ✅ All new math functions in Calculator.ts — Task 2
- ✅ Deg-mode trig wrapping — Task 2
- ✅ `calcBuiltInProfiles` updated — Task 5
- ✅ `[ANGLE_TOGGLE]` caption stays `'Rad'` in JSON default; CalcScreen patches to `'Deg'` when toggled — Task 4

**Type consistency:**
- `Keyset` in CalcContext includes `'scientific_landscape_2nd'` — used identically in CalcScreen
- `evaluate(expr, angleMode)` signature matches usage in `computeResult`
- `angleMode` ref kept in sync with state in CalcContext (same pattern as existing `resultMode`/`resultModeRef`)

**Notes:**
- `yroot(` and `logy(` keys are present in JSON but `Calculator.ts` has no handler for them — they will produce `Error` on evaluation, which is intentional per spec (deferred).
- `[ANGLE_TOGGLE]` caption in `scientific_landscape_2nd` JSON also defaults to `'Rad'`; `patchAngleToggleCaption` covers all keysets so it patches correctly regardless of active keyset.
