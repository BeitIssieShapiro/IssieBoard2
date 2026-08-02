# IssieCalc Large Number Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix IssieCalc to handle large numbers correctly — fixed font, basic mode cap at 12 digits, scientific mode auto-exponential for results ≥ 10^9.

**Architecture:** Four isolated changes: (1) add `numberTooBig` to localization strings, (2) extend `evaluate()` with a `mode` param and overflow/exponential logic, (3) cap digit input and pass mode in `CalcContext`, (4) wire fixed font + localized error display in `CalcScreen`.

**Tech Stack:** TypeScript, React Native

## Global Constraints

- No new dependencies
- iOS-first; no Android changes in this plan
- `strings.ts` type definition, English, Hebrew, and Arabic objects must all be updated together
- Exponential format: uppercase `E`, trailing zeros trimmed from mantissa (e.g. `1.23E+9`, not `1.200000e+9`)
- Basic overflow threshold: `Math.abs(result) >= 1e12`
- Scientific exponential threshold: `Math.abs(result) >= 1e9`
- Digit cap: 12 digits in trailing operand, basic mode only

---

### Task 1: Add `numberTooBig` localization string

**Files:**
- Modify: `src/localization/strings.ts`

**Interfaces:**
- Produces: `strings.globalSettings.numberTooBig: string` — consumed by Task 4

- [ ] **Step 1: Add to type definition**

In the `globalSettings` interface (around line 151, after `calcScientific: string;`):

```typescript
    calcBasic: string;
    calcScientific: string;
    numberTooBig: string;
```

- [ ] **Step 2: Add English string**

Around line 516, after `calcScientific: 'Scientific',`:

```typescript
    calcBasic: 'Basic',
    calcScientific: 'Scientific',
    numberTooBig: 'Number Too Big',
```

- [ ] **Step 3: Add Hebrew string**

Around line 866, after `calcScientific: 'מדעי',`:

```typescript
    calcBasic: 'בסיסי',
    calcScientific: 'מדעי',
    numberTooBig: 'המספר גדול מדי',
```

- [ ] **Step 4: Add Arabic string**

Around line 1216, after `calcScientific: 'علمي',`:

```typescript
    calcBasic: 'أساسي',
    calcScientific: 'علمي',
    numberTooBig: 'الرقم كبير جداً',
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieBoardNG
npx tsc --noEmit 2>&1 | grep -i "strings\|numberTooBig" | head -20
```
Expected: no errors about `numberTooBig`

---

### Task 2: Extend `evaluate()` with mode, overflow, and exponential formatting

**Files:**
- Modify: `apps/issiecalc/src/services/Calculator.ts`

**Interfaces:**
- Produces: `evaluate(expression: string, angleMode?: 'rad'|'deg', mode?: 'basic'|'scientific'): string`
  - Returns `'NUMBER_TOO_BIG'` when basic mode `|result| >= 1e12`
  - Returns exponential string (e.g. `'1.2E+9'`) when scientific mode `|result| >= 1e9`
  - Default `mode` is `'scientific'` for backwards compatibility
- Consumed by: Task 3 (`CalcContext.computeResult`), Task 4 (`CalcScreen` TTS call)

- [ ] **Step 1: Replace `evaluate()` in `Calculator.ts`**

Replace the existing `evaluate` function (lines 89–104) with:

```typescript
export function evaluate(
  expression: string,
  angleMode: 'rad' | 'deg' = 'rad',
  mode: 'basic' | 'scientific' = 'scientific'
): string {
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
    const abs = Math.abs(rounded);
    if (mode === 'basic' && abs >= 1e12) return 'NUMBER_TOO_BIG';
    if (mode === 'scientific' && abs >= 1e9) {
      const exp = rounded.toExponential(6);
      const [mantissa, exponent] = exp.split('e');
      const trimmed = mantissa.replace(/\.?0+$/, '');
      const sign = exponent.startsWith('-') ? '-' : '+';
      const expNum = Math.abs(parseInt(exponent, 10));
      return `${trimmed}E${sign}${expNum}`;
    }
    return String(rounded);
  } catch {
    return 'Error';
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieBoardNG
npx tsc --noEmit 2>&1 | grep -i "calculator" | head -10
```
Expected: no errors

- [ ] **Step 3: Manually verify key cases**

Open a Node REPL or mentally trace:
- `evaluate('999999999999', 'rad', 'basic')` → `'999999999999'` (exactly 1e12 - 1, no error)
- `evaluate('1000000000000', 'rad', 'basic')` → `'NUMBER_TOO_BIG'` (exactly 1e12)
- `evaluate('1200000000', 'rad', 'scientific')` → `'1.2E+9'` (trimmed zeros)
- `evaluate('1000000000', 'rad', 'scientific')` → `'1E+9'` (no decimal)
- `evaluate('1234567890', 'rad', 'scientific')` → `'1.23457E+9'` (6 sig figs after decimal)
- `evaluate('-2000000000', 'rad', 'scientific')` → `'-2E+9'` (negative)
- `evaluate('999999999', 'rad', 'scientific')` → `'999999999'` (< 1e9, no conversion)

---

### Task 3: Cap digit input and pass mode in `CalcContext`

**Files:**
- Modify: `apps/issiecalc/src/context/CalcContext.tsx`

**Interfaces:**
- Consumes: `evaluate(expr, angleMode, mode)` from Task 2
- `keysetRef` (new internal ref) used by `appendToExpression` and `computeResult`
- No new exports

- [ ] **Step 1: Add `countTrailingDigits` helper above `CalcProvider`**

Add before the `CalcProvider` component definition:

```typescript
function countTrailingDigits(expr: string): number {
  const match = expr.match(/\d*\.?\d+$/);
  if (!match) return 0;
  return (match[0].match(/\d/g) || []).length;
}
```

- [ ] **Step 2: Add `keysetRef` after the existing refs**

After the `memoryRef` line (around line 49), add:

```typescript
  const keysetRef = useRef<Keyset>('basic');
```

- [ ] **Step 3: Update `setKeyset` to also sync `keysetRef`**

The existing `setKeyset` (around line 141) is:
```typescript
  const setKeyset = useCallback((k: Keyset) => {
    setKeysetState(k);
    if (k === 'basic' || k === 'scientific') {
      KeyboardPreferences.setString(KEYSET_KEY, k);
    }
  }, []);
```

Replace with:
```typescript
  const setKeyset = useCallback((k: Keyset) => {
    keysetRef.current = k;
    setKeysetState(k);
    if (k === 'basic' || k === 'scientific') {
      KeyboardPreferences.setString(KEYSET_KEY, k);
    }
  }, []);
```

- [ ] **Step 4: Sync `keysetRef` when loading from storage**

In the `useEffect` that loads persisted keyset (around line 62), update:
```typescript
      if (savedKeyset === 'basic' || savedKeyset === 'scientific') {
        keysetRef.current = savedKeyset;
        setKeysetState(savedKeyset);
      }
```

- [ ] **Step 5: Update `appendToExpression` to cap digits in basic mode**

Replace the existing `appendToExpression` (lines 77–92) with:

```typescript
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
      if (keysetRef.current === 'basic' && /^\d$/.test(val)) {
        if (countTrailingDigits(expressionRef.current) >= 12) return;
      }
      expressionRef.current = expressionRef.current + val;
    }
    setExpression(expressionRef.current);
  }, []);
```

- [ ] **Step 6: Update `computeResult` to pass mode to `evaluate`**

`computeResult` is the function that actually sets the `result` state shown in the display. Replace it (around line 117):

```typescript
  const computeResult = useCallback(() => {
    const mode = keysetRef.current === 'basic' ? 'basic' : 'scientific';
    const res = evaluate(expressionRef.current, angleModeRef.current, mode);
    const finalRes = res === '' ? 'Error' : res;
    resultRef.current = finalRes;
    resultModeRef.current = true;
    setResult(finalRes);
    setResultMode(true);
  }, []);
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/i022021/dev/Issie/IssieBoardNG
npx tsc --noEmit 2>&1 | grep -i "calccontext" | head -10
```
Expected: no errors

---

### Task 4: Wire fixed font and localized error display in `CalcScreen`

**Files:**
- Modify: `apps/issiecalc/src/screens/CalcScreen.tsx`

**Interfaces:**
- Consumes:
  - `result` from `useCalc()` — may now be `'NUMBER_TOO_BIG'`
  - `evaluate(expr, angleMode, mode)` from Task 2 — TTS-only call on line 178
  - `strings.globalSettings.numberTooBig` from Task 1
  - `keyset` from `useCalc()` — already destructured

- [ ] **Step 1: Fix result font — remove `adjustsFontSizeToFit`, set fixed size**

Find the result `<Text>` (around line 264):
```tsx
<Text style={[styles.result, { color: displayTextColor }]} numberOfLines={1} adjustsFontSizeToFit>
```
Remove `adjustsFontSizeToFit`:
```tsx
<Text style={[styles.result, { color: displayTextColor }]} numberOfLines={1}>
```

In `StyleSheet.create`, update the `result` style (around line 313) — reduce from 64 to 48 to fit 12 digits:
```typescript
  result: { fontSize: 48, fontWeight: '300', color: '#FFFFFF', textAlign: 'right', alignSelf: 'stretch' },
```

- [ ] **Step 2: Pass mode to the TTS `evaluate()` call**

The `=` handler calls `evaluate()` a second time purely for TTS readout (line 178). Pass mode so the TTS value matches what's displayed:

```typescript
    if (value === '=') {
      computeResult();
      const res = evaluate(expression, angleMode, keyset === 'basic' ? 'basic' : 'scientific');
      const finalRes = res === '' ? 'Error' : res;
      readout('=', expression, finalRes);
      return;
    }
```

- [ ] **Step 3: Display localized string for `NUMBER_TOO_BIG`**

Find the result display (around line 265):
```tsx
{resultMode ? result : (formatExpression(expression) || '0')}
```
Replace with:
```tsx
{resultMode
  ? (result === 'NUMBER_TOO_BIG' ? strings.globalSettings.numberTooBig : result)
  : (formatExpression(expression) || '0')}
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

```bash
cd /Users/i022021/dev/Issie/IssieBoardNG
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 5: Manual test checklist**

Build and run IssieCalc on iOS. Verify:

| Scenario | Expected |
|----------|----------|
| Basic: type 12 digits | 13th digit press silently ignored |
| Basic: `999999999999 =` | Shows `999999999999` (no error) |
| Basic: `999999999999 + 1 =` | Shows localized "Number Too Big" |
| Basic: `-999999999999 =` | Shows `-999999999999` (no error) |
| Basic: `-999999999999 - 1 =` | Shows localized "Number Too Big" |
| Scientific: `1200000000 =` | Shows `1.2E+9` |
| Scientific: `1000000000 =` | Shows `1E+9` |
| Scientific: `-2500000000 =` | Shows `-2.5E+9` |
| Scientific: `999999999 =` | Shows `999999999` (< 1e9, no conversion) |
| Any mode: `1 / 0 =` | Still shows `Error` |
| Result font | Fixed size, does not shrink for long numbers |
