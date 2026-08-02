# IssieCalc Large Number Handling

**Date:** 2026-08-02

## Problem

Three related issues with large numbers in IssieCalc:
1. Font shrinks as digits grow (via `adjustsFontSizeToFit`) — hard to read, inconsistent
2. Basic mode has no input or result cap — results can overflow silently
3. Scientific mode shows raw large numbers instead of readable exponential notation

## Goals

- Fixed, consistent font size for results regardless of digit count
- Basic mode: cap input at 12 digits; show localized error if result exceeds 12 digits
- Scientific mode: auto-convert results ≥ 10^9 (or ≤ -10^9) to exponential notation

---

## Design

### 1. Fixed Font Size

**File:** `apps/issiecalc/src/screens/CalcScreen.tsx`

Remove `adjustsFontSizeToFit` from the result `<Text>` component. Set a fixed `fontSize: 48`. This fits 12 digits plus sign comfortably on typical screen widths and stays readable.

### 2. Basic Mode — Input Cap (12 digits)

**File:** `apps/issiecalc/src/context/CalcContext.tsx`

In `appendToExpression`, before appending, check:
- Is the current `keyset === 'basic'`?
- Is the value a single digit (`/^\d$/`)?
- Does the trailing number in the current expression already have 12 digits?

If all three: ignore the press silently (no feedback, same as iOS Calculator behavior).

Digit count = count of `[0-9]` characters in the trailing operand only (not the full expression), so `123 + 456` allows up to 12 digits in `456`.

### 3. Basic Mode — Result Overflow Error

**File:** `apps/issiecalc/src/services/Calculator.ts`

`evaluate()` gains an optional `mode: 'basic' | 'scientific'` parameter (default `'scientific'` for backwards compat).

After computing `rounded`:
- If `mode === 'basic'` and `Math.abs(rounded) >= 1e12` → return `'NUMBER_TOO_BIG'` sentinel

**File:** `apps/issiecalc/src/screens/CalcScreen.tsx`

Pass `keyset === 'basic' ? 'basic' : 'scientific'` to `evaluate()` on `=` press.

When result is `'NUMBER_TOO_BIG'`, display the localized string `strings.calc.numberTooBig` instead.

### 4. Scientific Mode — Exponential Notation

**File:** `apps/issiecalc/src/services/Calculator.ts`

After computing `rounded`, if `mode === 'scientific'` and `Math.abs(rounded) >= 1e9`:
- Format with `toExponential(6)` 
- Trim trailing zeros from mantissa: `1.200000e+9` → `1.2e+9`, `1.000000e+12` → `1e+12`
- Uppercase `E`: `1.23e+9` → `1.23E+9` (matches scientific convention)

### 5. Localized Error String

**File:** `src/localization/strings.ts`

Add `numberTooBig` to the `calc` section of the `Strings` type and all 3 language objects:

| Language | String |
|----------|--------|
| English  | `"Number Too Big"` |
| Hebrew   | `"המספר גדול מדי"` |
| Arabic   | `"الرقم كبير جداً"` |

---

## Files Changed

| File | Change |
|------|--------|
| `apps/issiecalc/src/services/Calculator.ts` | Add `mode` param, overflow check, exponential formatting |
| `apps/issiecalc/src/context/CalcContext.tsx` | Digit cap in `appendToExpression` |
| `apps/issiecalc/src/screens/CalcScreen.tsx` | Fixed font, pass mode to evaluate, display localized error |
| `src/localization/strings.ts` | Add `numberTooBig` in 3 languages |

---

## Out of Scope

- Capping the expression line (only the result line is fixed font)
- Showing error when user types too many digits (silent ignore is sufficient)
- Changing precision of scientific results (stays at `toPrecision(12)` before exponential formatting)
