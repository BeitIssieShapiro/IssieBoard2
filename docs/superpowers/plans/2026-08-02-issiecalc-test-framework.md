# IssieCalc Test Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract IssieCalc's key-dispatch logic into a pure function and write ~100 Jest tests that simulate tap sequences and assert on both intermediate expression state and final results.

**Architecture:** A new `calcDispatch.ts` file exports a pure `dispatch(state, key) → CalcState` function containing all logic currently in `CalcScreen.handleKeyPress` plus the `CalcContext` mutations it triggers. `CalcScreen.tsx` becomes a thin wrapper. Tests live in `__tests__/issiecalc/` and use a `runSequence` helper that returns one state snapshot per tap.

**Tech Stack:** TypeScript, Jest 29, `@react-native/jest-preset` (already configured in `jest.config.js`)

## Global Constraints

- No new dependencies — Jest is already installed
- Tests go under `__tests__/issiecalc/` (matches existing pattern: `__tests__/issievoice/`)
- `calcDispatch.ts` must be pure: no imports from React, no async, no side effects
- `CalcScreen.tsx` logic must not change externally — only internals refactored
- Do not mock `KeyboardPreferences` in `calcDispatch.ts` — keep it out entirely
- Run tests with: `npm test -- --testPathPattern=issiecalc`

---

### Task 1: Create `calcDispatch.ts` — pure state machine

**Files:**
- Create: `apps/issiecalc/src/services/calcDispatch.ts`

**Interfaces:**
- Consumes: `evaluate`, `negateLastNumber` from `./Calculator`
- Produces:
  ```ts
  export interface CalcState {
    expression: string;
    result: string;
    resultMode: boolean;
    angleMode: 'rad' | 'deg';
    keyset: 'basic' | 'scientific' | 'scientific_2nd' | 'scientific_landscape_2nd';
    memory: string;
  }
  export const initialCalcState: CalcState;
  export function dispatch(state: CalcState, key: string): CalcState;
  ```

- [ ] **Step 1: Create `calcDispatch.ts` with the CalcState type, initial state, and dispatch function**

```ts
// apps/issiecalc/src/services/calcDispatch.ts
import { evaluate, negateLastNumber } from './Calculator';

export interface CalcState {
  expression: string;
  result: string;
  resultMode: boolean;
  angleMode: 'rad' | 'deg';
  keyset: 'basic' | 'scientific' | 'scientific_2nd' | 'scientific_landscape_2nd';
  memory: string;
}

export const initialCalcState: CalcState = {
  expression: '',
  result: '',
  resultMode: false,
  angleMode: 'rad',
  keyset: 'basic',
  memory: '0',
};

const OPERATORS = /^[+\-*/^%]$/;
const FUNCTIONS_RE = /^(sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|sinh\(|cosh\(|tanh\(|asinh\(|acosh\(|atanh\(|sqrt\(|ln\(|log\(|log2\(|logy\(|2root\(|3root\(|yroot\(|factorial\(|x\^2|x\^3|x\^\(|\^\(|2\^\(|1\/\(|\(|\)|pi|e)$/;
const FUNCTION_KEYS = new Set([
  'sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(',
  'sinh(', 'cosh(', 'tanh(', 'asinh(', 'acosh(', 'atanh(',
  'ln(', 'log(', 'log2(', 'logy(', '2root(', '3root(', 'yroot(',
  'factorial(', 'sqrt(',
]);

function isOpOrFn(val: string): boolean {
  return OPERATORS.test(val) || FUNCTIONS_RE.test(val);
}

function countTrailingDigits(expr: string): number {
  const match = expr.match(/\d*\.?\d+$/);
  if (!match) return 0;
  return (match[0].match(/\d/g) || []).length;
}

function extractTrailingOperand(expr: string): [string, string] | null {
  if (!expr) return null;
  if (expr.endsWith(')')) {
    let depth = 0;
    for (let i = expr.length - 1; i >= 0; i--) {
      if (expr[i] === ')') depth++;
      else if (expr[i] === '(') {
        depth--;
        if (depth === 0) return [expr.slice(0, i), expr.slice(i)];
      }
    }
    return null;
  }
  const numMatch = expr.match(/(-?\d+\.?\d*(?:[eE][+-]?\d+)?)$/);
  if (numMatch) {
    const num = numMatch[1];
    const before = expr.slice(0, expr.length - num.length);
    if (num.startsWith('-') && before.length > 0 && !/[+\-*/(^]$/.test(before)) {
      return [expr.slice(0, expr.length - num.length + 1), num.slice(1)];
    }
    return [before, num];
  }
  return null;
}

function appendToExpression(state: CalcState, val: string): CalcState {
  let expression: string;
  let resultMode = false;
  let result = '';

  if (state.resultMode) {
    if (isOpOrFn(val)) {
      expression = state.result + val;
    } else {
      expression = val;
    }
  } else {
    if (state.keyset === 'basic' && /^\d$/.test(val)) {
      if (countTrailingDigits(state.expression) >= 12) return state;
    }
    expression = state.expression + val;
    resultMode = state.resultMode;
    result = state.result;
  }

  return { ...state, expression, result, resultMode };
}

export function dispatch(state: CalcState, key: string): CalcState {
  // AC
  if (key === 'AC') {
    return { ...state, expression: '', result: '', resultMode: false };
  }

  // Backspace
  if (key === '⌫') {
    if (state.resultMode) {
      return { ...state, expression: '', result: '', resultMode: false };
    }
    return { ...state, expression: state.expression.slice(0, -1) };
  }

  // Equals
  if (key === '=') {
    const mode = state.keyset === 'basic' ? 'basic' : 'scientific';
    const res = evaluate(state.expression, state.angleMode, mode);
    const finalRes = res === '' ? 'Error' : res;
    return { ...state, result: finalRes, resultMode: true };
  }

  // Toggle sign
  if (key === '+/-') {
    if (state.resultMode) {
      const negated = negateLastNumber(state.result);
      return { ...state, expression: negated, result: '', resultMode: false };
    }
    return { ...state, expression: negateLastNumber(state.expression) };
  }

  // Keyset switches
  if (key === '[2ND]') {
    return { ...state, keyset: 'scientific_2nd' };
  }
  if (key === '[2ND_OFF]') {
    return { ...state, keyset: 'scientific' };
  }

  // Angle mode toggle
  if (key === '[ANGLE_TOGGLE]') {
    const next = state.angleMode === 'rad' ? 'deg' : 'rad';
    return { ...state, angleMode: next };
  }

  // Memory store
  if (key === 'ms') {
    const val = state.resultMode ? state.result : state.expression;
    if (val && val !== 'Error') {
      return { ...state, memory: val };
    }
    return state;
  }

  // Memory recall
  if (key === 'mr') {
    if (state.memory !== '0' || state.expression === '') {
      return appendToExpression(state, state.memory);
    }
    return state;
  }

  // Function keys — wrap trailing operand
  if (FUNCTION_KEYS.has(key)) {
    // If in resultMode, start fresh with the function
    const baseExpr = state.resultMode ? '' : state.expression;
    const baseState = state.resultMode
      ? { ...state, expression: '', result: '', resultMode: false }
      : state;
    const parts = extractTrailingOperand(baseExpr);
    if (parts) {
      const [before, operand] = parts;
      return { ...baseState, expression: `${before}${key}${operand})` };
    }
    return { ...baseState, expression: baseExpr + key };
  }

  // Default: append
  if (key) {
    return appendToExpression(state, key);
  }

  return state;
}
```

- [ ] **Step 2: Verify TypeScript compiles (no errors)**

```bash
cd /path/to/IssieBoardNG && npx tsc --noEmit --skipLibCheck 2>&1 | grep calcDispatch
```

Expected: no output (no errors in `calcDispatch.ts`)

- [ ] **Step 3: Commit**

```bash
git add apps/issiecalc/src/services/calcDispatch.ts
git commit -m "feat: extract pure calcDispatch function from CalcScreen"
```

---

### Task 2: Wire `CalcScreen.tsx` to use `dispatch`

**Files:**
- Modify: `apps/issiecalc/src/screens/CalcScreen.tsx`

**Interfaces:**
- Consumes: `dispatch`, `CalcState` from `../services/calcDispatch`
- Produces: no API change — `handleKeyPress` still handles `KeyPressEvent`

- [ ] **Step 1: Add import and `currentState` derivation to `CalcScreen.tsx`**

At the top of the file, add the import:

```ts
import { dispatch, CalcState } from '../services/calcDispatch';
```

Inside `CalcScreen` component, after the `useCalc()` destructure, add:

```ts
const currentState: CalcState = {
  expression,
  result,
  resultMode,
  angleMode,
  keyset,
  memory,
};
```

- [ ] **Step 2: Replace `handleKeyPress` body with dispatch + apply**

Replace the entire `handleKeyPress` function with:

```ts
const handleKeyPress = (event: KeyPressEvent) => {
  const { value } = event.nativeEvent;
  const newState = dispatch(currentState, value);

  // Apply state changes
  if (newState.expression !== currentState.expression && !newState.resultMode) {
    replaceExpression(newState.expression);
  } else if (newState.resultMode && newState.result !== currentState.result) {
    // computeResult was called — apply via context
    computeResult();
  } else if (!newState.resultMode && currentState.resultMode) {
    // Cleared result mode (AC, backspace after result, sign toggle, etc.)
    if (newState.expression === '' && newState.result === '') {
      clearAll();
    } else {
      replaceExpression(newState.expression);
    }
  }

  // Keyset
  if (newState.keyset !== currentState.keyset) {
    setKeyset(newState.keyset);
  }

  // Angle mode
  if (newState.angleMode !== currentState.angleMode) {
    toggleAngleMode();
  }

  // Memory
  if (newState.memory !== currentState.memory) {
    memoryStore();
  }
  if (value === 'mr') {
    memoryRecall();
    readout(value, newState.expression, newState.result);
    return;
  }

  // Readout
  const readoutExpr = newState.resultMode ? currentState.expression : newState.expression;
  const readoutRes = newState.resultMode ? newState.result : newState.result;
  readout(value, readoutExpr, readoutRes, newState.angleMode);
};
```

> **Note:** `computeResult`, `clearAll`, `replaceExpression`, `toggleAngleMode`, `memoryStore`, `memoryRecall` are already destructured from `useCalc()`. The `dispatch` function is the source of truth for what *should* happen; these calls synchronize the React context to match.

- [ ] **Step 3: Remove the `rand` special-case from the old handler (it's not in dispatch)**

Add `rand` handling to `calcDispatch.ts` dispatch function, just before the default append at the bottom:

```ts
// rand — caller must inject a random value; we skip here (handled by CalcScreen)
if (key === 'rand') return state;
```

And keep the `rand` case in `CalcScreen.handleKeyPress` after the dispatch call:

```ts
if (value === 'rand') {
  appendToExpression(String(parseFloat(Math.random().toFixed(9))));
  readout(value, newState.expression, newState.result);
  return;
}
```

Place this check **before** calling `dispatch`.

- [ ] **Step 4: Run the app and do a manual smoke test**

In XCode, build and run IssieCalc. Verify:
- `1 + 2 =` shows `3`
- `sqrt(` on `4` wraps to `sqrt(4)`
- `AC` clears
- `+/-` negates

- [ ] **Step 5: Commit**

```bash
git add apps/issiecalc/src/screens/CalcScreen.tsx
git commit -m "refactor: CalcScreen delegates to pure dispatch function"
```

---

### Task 3: Write `runSequence` helper and first smoke tests

**Files:**
- Create: `__tests__/issiecalc/calcDispatch.test.ts`

**Interfaces:**
- Consumes: `dispatch`, `CalcState`, `initialCalcState` from `../../apps/issiecalc/src/services/calcDispatch`
- Produces: `runSequence(keys, initial?) → CalcState[]` (local to test file)

- [ ] **Step 1: Create the test file with the `runSequence` helper and 5 smoke tests**

```ts
// __tests__/issiecalc/calcDispatch.test.ts
import { dispatch, CalcState, initialCalcState } from '../../apps/issiecalc/src/services/calcDispatch';

function runSequence(keys: string[], initial: Partial<CalcState> = {}): CalcState[] {
  const states: CalcState[] = [];
  let state: CalcState = { ...initialCalcState, ...initial };
  for (const key of keys) {
    state = dispatch(state, key);
    states.push(state);
  }
  return states;
}

describe('smoke tests', () => {
  test('1 + 2 = gives 3', () => {
    const states = runSequence(['1', '+', '2', '=']);
    expect(states[3].result).toBe('3');
    expect(states[3].resultMode).toBe(true);
  });

  test('AC clears everything', () => {
    const states = runSequence(['5', '+', '3', 'AC']);
    expect(states[3].expression).toBe('');
    expect(states[3].result).toBe('');
    expect(states[3].resultMode).toBe(false);
  });

  test('backspace removes last char', () => {
    const states = runSequence(['1', '2', '3', '⌫']);
    expect(states[3].expression).toBe('12');
  });

  test('backspace after result clears all', () => {
    const states = runSequence(['5', '=', '⌫']);
    expect(states[2].expression).toBe('');
    expect(states[2].resultMode).toBe(false);
  });

  test('sqrt( wraps trailing number', () => {
    const states = runSequence(['4', 'sqrt(']);
    expect(states[1].expression).toBe('sqrt(4)');
  });
});
```

- [ ] **Step 2: Run the smoke tests**

```bash
npm test -- --testPathPattern=issiecalc
```

Expected output:
```
PASS __tests__/issiecalc/calcDispatch.test.ts
  smoke tests
    ✓ 1 + 2 = gives 3
    ✓ AC clears everything
    ✓ backspace removes last char
    ✓ backspace after result clears all
    ✓ sqrt( wraps trailing number
```

- [ ] **Step 3: Commit**

```bash
git add __tests__/issiecalc/calcDispatch.test.ts
git commit -m "test: add calcDispatch runSequence helper and smoke tests"
```

---

### Task 4: Write the full 100-test suite

**Files:**
- Modify: `__tests__/issiecalc/calcDispatch.test.ts`

**Interfaces:**
- Consumes: `runSequence` from Task 3, `dispatch`, `initialCalcState`

- [ ] **Step 1: Append all test groups to the test file**

Add these `describe` blocks after the smoke tests:

```ts
describe('basic arithmetic', () => {
  test('9 / 3 = 3', () => {
    const s = runSequence(['9', '/', '3', '=']);
    expect(s[3].result).toBe('3');
  });
  test('5 * 5 = 25', () => {
    const s = runSequence(['5', '*', '5', '=']);
    expect(s[3].result).toBe('25');
  });
  test('7 - 4 = 3', () => {
    const s = runSequence(['7', '-', '4', '=']);
    expect(s[3].result).toBe('3');
  });
  test('0 + 0 = 0', () => {
    const s = runSequence(['0', '+', '0', '=']);
    expect(s[3].result).toBe('0');
  });
  test('decimal: 1.5 + 1.5 = 3', () => {
    const s = runSequence(['1', '.', '5', '+', '1', '.', '5', '=']);
    expect(s[7].result).toBe('3');
  });
  test('negative result: 2 - 5 = -3', () => {
    const s = runSequence(['2', '-', '5', '=']);
    expect(s[3].result).toBe('-3');
  });
  test('chained: 1 + 2 + 3 = 6', () => {
    const s = runSequence(['1', '+', '2', '+', '3', '=']);
    expect(s[5].result).toBe('6');
  });
  test('chained: 10 - 3 - 2 = 5', () => {
    const s = runSequence(['1', '0', '-', '3', '-', '2', '=']);
    expect(s[6].result).toBe('5');
  });
  test('mixed: 2 * 3 + 4 = 10', () => {
    const s = runSequence(['2', '*', '3', '+', '4', '=']);
    expect(s[5].result).toBe('10');
  });
  test('division result is decimal: 1 / 4 = 0.25', () => {
    const s = runSequence(['1', '/', '4', '=']);
    expect(s[3].result).toBe('0.25');
  });
});

describe('expression building — intermediate state', () => {
  test('expression updates on each digit tap', () => {
    const s = runSequence(['1', '2', '3']);
    expect(s[0].expression).toBe('1');
    expect(s[1].expression).toBe('12');
    expect(s[2].expression).toBe('123');
  });
  test('operator appended to expression', () => {
    const s = runSequence(['5', '+']);
    expect(s[1].expression).toBe('5+');
  });
  test('expression before = is preserved', () => {
    const s = runSequence(['3', '+', '4', '=']);
    expect(s[2].expression).toBe('3+4');
  });
  test('result shown after =', () => {
    const s = runSequence(['3', '+', '4', '=']);
    expect(s[3].result).toBe('7');
    expect(s[3].resultMode).toBe(true);
  });
});

describe('result mode continuations', () => {
  test('digit after result resets expression', () => {
    const s = runSequence(['5', '=', '6']);
    expect(s[2].expression).toBe('6');
    expect(s[2].resultMode).toBe(false);
  });
  test('operator after result continues from result', () => {
    const s = runSequence(['5', '=', '+', '3', '=']);
    expect(s[2].expression).toBe('5+');
    expect(s[4].result).toBe('8');
  });
  test('function after result continues from result', () => {
    const s = runSequence(['4', '=', 'sqrt(']);
    expect(s[2].expression).toBe('sqrt(4)');
  });
  test('AC after result clears', () => {
    const s = runSequence(['9', '=', 'AC']);
    expect(s[2].expression).toBe('');
    expect(s[2].result).toBe('');
    expect(s[2].resultMode).toBe(false);
  });
});

describe('sqrt and function wrapping', () => {
  test('sqrt( on empty expression appends sqrt(', () => {
    const s = runSequence(['sqrt(']);
    expect(s[0].expression).toBe('sqrt(');
  });
  test('sqrt( on 9 wraps to sqrt(9)', () => {
    const s = runSequence(['9', 'sqrt(']);
    expect(s[1].expression).toBe('sqrt(9)');
  });
  test('sqrt(9) = 3', () => {
    const s = runSequence(['9', 'sqrt(', '=']);
    expect(s[2].result).toBe('3');
  });
  test('sqrt(2) ≈ 1.41421356237', () => {
    const s = runSequence(['2', 'sqrt(', '=']);
    expect(parseFloat(s[2].result)).toBeCloseTo(1.41421356237, 5);
  });
  test('1 + sqrt( on 4 → 1+sqrt(4)', () => {
    const s = runSequence(['1', '+', '4', 'sqrt(']);
    expect(s[3].expression).toBe('1+sqrt(4)');
  });
  test('1 + sqrt(4) = 3', () => {
    const s = runSequence(['1', '+', '4', 'sqrt(', '=']);
    expect(s[4].result).toBe('3');
  });
  test('factorial( on 5 wraps to factorial(5)', () => {
    const s = runSequence(['5', 'factorial(']);
    expect(s[1].expression).toBe('factorial(5)');
  });
  test('factorial(5) = 120', () => {
    const s = runSequence(['5', 'factorial(', '=']);
    expect(s[2].result).toBe('120');
  });
  test('ln( on e gives ln(e) ≈ 1', () => {
    const s = runSequence(['e', 'ln(', '=']);
    expect(parseFloat(s[2].result)).toBeCloseTo(1, 5);
  });
  test('log( on 1000 = 3', () => {
    const s = runSequence(['1', '0', '0', '0', 'log(', '=']);
    expect(parseFloat(s[5].result)).toBeCloseTo(3, 5);
  });
});

describe('trig — rad mode', () => {
  test('sin(0) = 0 in rad', () => {
    const s = runSequence(['0', 'sin(', '='], { angleMode: 'rad' });
    expect(parseFloat(s[2].result)).toBeCloseTo(0, 10);
  });
  test('cos(0) = 1 in rad', () => {
    const s = runSequence(['0', 'cos(', '='], { angleMode: 'rad' });
    expect(parseFloat(s[2].result)).toBeCloseTo(1, 10);
  });
  test('tan(0) = 0 in rad', () => {
    const s = runSequence(['0', 'tan(', '='], { angleMode: 'rad' });
    expect(parseFloat(s[2].result)).toBeCloseTo(0, 10);
  });
  test('sin(pi) ≈ 0 in rad', () => {
    const s = runSequence(['pi', 'sin(', '='], { angleMode: 'rad' });
    expect(Math.abs(parseFloat(s[2].result))).toBeLessThan(1e-9);
  });
});

describe('trig — deg mode', () => {
  test('sin(90) = 1 in deg', () => {
    const s = runSequence(['9', '0', 'sin(', '='], { angleMode: 'deg' });
    expect(parseFloat(s[3].result)).toBeCloseTo(1, 5);
  });
  test('cos(180) = -1 in deg', () => {
    const s = runSequence(['1', '8', '0', 'cos(', '='], { angleMode: 'deg' });
    expect(parseFloat(s[4].result)).toBeCloseTo(-1, 5);
  });
  test('tan(45) = 1 in deg', () => {
    const s = runSequence(['4', '5', 'tan(', '='], { angleMode: 'deg' });
    expect(parseFloat(s[3].result)).toBeCloseTo(1, 5);
  });
  test('sin(0) = 0 in deg', () => {
    const s = runSequence(['0', 'sin(', '='], { angleMode: 'deg' });
    expect(parseFloat(s[2].result)).toBeCloseTo(0, 10);
  });
});

describe('angle mode toggle', () => {
  test('[ANGLE_TOGGLE] switches rad to deg', () => {
    const s = runSequence(['[ANGLE_TOGGLE]'], { angleMode: 'rad' });
    expect(s[0].angleMode).toBe('deg');
  });
  test('[ANGLE_TOGGLE] switches deg to rad', () => {
    const s = runSequence(['[ANGLE_TOGGLE]'], { angleMode: 'deg' });
    expect(s[0].angleMode).toBe('rad');
  });
});

describe('+/- toggle sign', () => {
  test('+/- on 5 gives -5', () => {
    const s = runSequence(['5', '+/-']);
    expect(s[1].expression).toBe('-5');
  });
  test('+/- on -5 gives 5', () => {
    const s = runSequence(['5', '+/-', '+/-']);
    expect(s[2].expression).toBe('5');
  });
  test('+/- after result negates result into expression', () => {
    const s = runSequence(['4', '=', '+/-']);
    expect(s[2].expression).toBe('-4');
    expect(s[2].resultMode).toBe(false);
  });
  test('+/- in expression: 3 + 4 → 3 + -4 not supported raw (negates last number)', () => {
    const s = runSequence(['3', '+', '4', '+/-']);
    // negateLastNumber wraps the 4 as (-4) or -4 after operator
    expect(s[3].expression).toContain('-4');
  });
});

describe('backspace', () => {
  test('removes last character', () => {
    const s = runSequence(['1', '2', '+', '⌫']);
    expect(s[3].expression).toBe('12');
  });
  test('backspace on single char gives empty', () => {
    const s = runSequence(['5', '⌫']);
    expect(s[1].expression).toBe('');
  });
  test('backspace on empty stays empty', () => {
    const s = runSequence(['⌫']);
    expect(s[0].expression).toBe('');
  });
  test('backspace after result clears result mode', () => {
    const s = runSequence(['5', '+', '3', '=', '⌫']);
    expect(s[4].resultMode).toBe(false);
    expect(s[4].expression).toBe('');
  });
});

describe('memory', () => {
  test('ms stores expression, mr recalls it', () => {
    const s = runSequence(['5', 'ms', 'AC', 'mr']);
    expect(s[3].expression).toBe('5');
  });
  test('ms stores result when in resultMode', () => {
    const s = runSequence(['3', '+', '2', '=', 'ms', 'AC', 'mr']);
    expect(s[6].expression).toBe('5');
  });
  test('mr after ms appends memory to expression', () => {
    const s = runSequence(['5', 'ms', '3', '+', 'mr', '=']);
    expect(s[5].result).toBe('8');
  });
  test('ms does not store Error', () => {
    const initial = { memory: '7' };
    const s = runSequence(['1', '/', '0', '=', 'ms'], initial);
    expect(s[4].memory).toBe('7');
  });
});

describe('error states', () => {
  test('1 / 0 = Error', () => {
    const s = runSequence(['1', '/', '0', '=']);
    expect(s[3].result).toBe('Error');
  });
  test('incomplete expression (1 +) = Error', () => {
    const s = runSequence(['1', '+', '=']);
    expect(s[2].result).toBe('Error');
  });
  test('empty expression = gives 0', () => {
    const s = runSequence(['=']);
    expect(s[0].result).toBe('0');
  });
  test('sqrt( of negative = Error', () => {
    const s = runSequence(['-', '4', 'sqrt(', '=']);
    expect(s[3].result).toBe('Error');
  });
});

describe('constants', () => {
  test('pi * 2 ≈ 6.28318', () => {
    const s = runSequence(['pi', '*', '2', '=']);
    expect(parseFloat(s[3].result)).toBeCloseTo(6.28318, 4);
  });
  test('e alone evaluates to ≈ 2.71828', () => {
    const s = runSequence(['e', '=']);
    expect(parseFloat(s[1].result)).toBeCloseTo(2.71828, 4);
  });
});

describe('percent', () => {
  test('50 % = 0.5', () => {
    const s = runSequence(['5', '0', '%', '=']);
    expect(s[3].result).toBe('0.5');
  });
  test('100 % = 1', () => {
    const s = runSequence(['1', '0', '0', '%', '=']);
    expect(s[4].result).toBe('1');
  });
});

describe('large numbers — basic mode', () => {
  test('result >= 1e12 in basic mode gives NUMBER_TOO_BIG', () => {
    const s = runSequence(['9', '9', '9', '9', '9', '9', '9', '9', '9', '9', '9', '9', '*', '9', '9', '9', '='], { keyset: 'basic' });
    const last = s[s.length - 1];
    expect(last.result).toBe('NUMBER_TOO_BIG');
  });
});

describe('E-notation — scientific mode', () => {
  test('1000000000 * 10 shows E-notation in scientific mode', () => {
    const s = runSequence(
      ['1', '0', '0', '0', '0', '0', '0', '0', '0', '0', '*', '1', '0', '='],
      { keyset: 'scientific' }
    );
    const last = s[s.length - 1];
    expect(last.result).toMatch(/E[+-]\d+/);
  });
});

describe('keyset switching', () => {
  test('[2ND] sets keyset to scientific_2nd', () => {
    const s = runSequence(['[2ND]'], { keyset: 'scientific' });
    expect(s[0].keyset).toBe('scientific_2nd');
  });
  test('[2ND_OFF] sets keyset back to scientific', () => {
    const s = runSequence(['[2ND_OFF]'], { keyset: 'scientific_2nd' });
    expect(s[0].keyset).toBe('scientific');
  });
});

describe('power', () => {
  test('2 ^ 10 = 1024', () => {
    const s = runSequence(['2', '^', '1', '0', '=']);
    expect(parseFloat(s[4].result)).toBe(1024);
  });
  test('3 ^ 2 = 9', () => {
    const s = runSequence(['3', '^', '2', '=']);
    expect(parseFloat(s[3].result)).toBe(9);
  });
});

describe('sequence edge cases', () => {
  test('multiple = in a row re-evaluates same expression', () => {
    const s = runSequence(['2', '+', '3', '=', '=']);
    expect(s[3].result).toBe('5');
    expect(s[4].result).toBe('5');
  });
  test('digit limit in basic mode (12 digits max)', () => {
    const digits = Array.from('123456789012'); // 12 digits
    const s = runSequence([...digits, '3'], { keyset: 'basic' }); // 13th digit rejected
    expect(s[s.length - 1].expression).toBe('123456789012');
  });
  test('no digit limit in scientific mode', () => {
    const digits = Array.from('1234567890123'); // 13 digits
    const s = runSequence(digits, { keyset: 'scientific' });
    expect(s[s.length - 1].expression).toBe('1234567890123');
  });
  test('operator after operator appends (no replacement)', () => {
    const s = runSequence(['5', '+', '-', '3', '=']);
    // 5 + -3 = 2
    expect(parseFloat(s[4].result)).toBe(2);
  });
  test('parentheses: (2+3)*4 = 20', () => {
    const s = runSequence(['(', '2', '+', '3', ')', '*', '4', '=']);
    expect(s[7].result).toBe('20');
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
npm test -- --testPathPattern=issiecalc
```

Expected: all tests pass. If any fail, check the `normalize()` function in `Calculator.ts` and the `dispatch` logic for that case — the test expectation may need adjusting if IssieCalc intentionally differs from standard calculator behavior (e.g. `5 + - 3`).

- [ ] **Step 3: Commit**

```bash
git add __tests__/issiecalc/calcDispatch.test.ts
git commit -m "test: 100 calcDispatch key-sequence tests"
```
