# IssieCalc — Scientific Landscape Layout Redesign
_2026-07-23_

## Overview

Improve the `scientific_landscape` keyset to match Apple Calculator's scientific layout: 5 rows × 10 keys (left science zone + right numpad), with a `2nd` toggle that swaps trig/hyperbolic/power functions to their inverses. Rad/Deg is RN state — no keyset switch needed.

---

## 1. Keysets (`keyboards/calc.json`)

### Two new keysets (replace current `scientific_landscape`)

**`scientific_landscape`** — normal mode:

```
Row 1: (    )    ms    mr    ⌫    AC    %    ÷       [8 keys]
Row 2: [2ND] x²   x³   xʸ   yˣ   2ˣ   7    8    9   ×
Row 3: 1/x  ²√x  ³√x  ʸ√x  logᵧ log₂  4    5    6   −
Row 4: x!   sin( cos( tan(  e    ln(   1    2    3   +
Row 5: Rand sinh( cosh( tanh( π  [RAD] +/-  0    .   =
```

**`scientific_landscape_2nd`** — 2nd pressed:

```
Row 1: same as above (memory/utility unchanged)
Row 2: [2ND] x²   x³   xʸ   yˣ   2ˣ   7    8    9   ×   (2nd key highlighted)
Row 3: 1/x  ²√x  ³√x  ʸ√x  logᵧ log₂  4    5    6   −   (unchanged)
Row 4: x!   asin( acos( atan( eˣ  ln(   1    2    3   +
Row 5: Rand asinh( acosh( atanh( π [RAD] +/-  0    .   =
```

Row 1 has 8 keys (ms/mr instead of Apple's 6-key mc/m+/m-/mr block). Rows 2–5 have 10 keys each.

### Key values (JSON)

| Display | `value` | Notes |
|---------|---------|-------|
| `2nd` | `[2ND]` | switches to `scientific_landscape_2nd`; in _2nd keyset emits `[2ND_OFF]` |
| `ms` | `ms` | store memory |
| `mr` | `mr` | recall memory |
| `x²` | `x^2` | |
| `x³` | `x^3` | |
| `xʸ` | `x^(` | user types exponent, closes `)` |
| `yˣ` | `^(` | append `^(` |
| `2ˣ` | `2^(` | |
| `1/x` | `1/(` | appends `1/(` |
| `²√x` | `2root(` | custom sentinel |
| `³√x` | `3root(` | |
| `ʸ√x` | `yroot(` | appends text; multi-arg parsing deferred — evaluates to Error |
| `logᵧ` | `logy(` | appends text; multi-arg parsing deferred — evaluates to Error |
| `log₂` | `log2(` | |
| `x!` | `factorial(` | |
| `sin(` | `sin(` | |
| `cos(` | `cos(` | |
| `tan(` | `tan(` | |
| `e` | `e` | Euler's number constant |
| `ln(` | `ln(` | |
| `Rand` | `rand` | |
| `sinh(` | `sinh(` | |
| `cosh(` | `cosh(` | |
| `tanh(` | `tanh(` | |
| `π` | `pi` | existing |
| `Rad/Deg` | `[ANGLE_TOGGLE]` | label patched at runtime by CalcScreen |
| `asin(` | `asin(` | 2nd only |
| `acos(` | `acos(` | 2nd only |
| `atan(` | `atan(` | 2nd only |
| `eˣ` | `e^(` | 2nd only |
| `asinh(` | `asinh(` | 2nd only |
| `acosh(` | `acosh(` | 2nd only |
| `atanh(` | `atanh(` | 2nd only |

---

## 2. CalcContext changes

### New state
- `angleMode: 'rad' | 'deg'` — default `'rad'`
- `memory: string` — default `'0'`

### New actions
- `toggleAngleMode()` — flips `angleMode`
- `memoryStore()` — stores current result (or expression value) to `memory`
- `memoryRecall()` — appends `memory` value to expression
- `setScientificKeyset(k: 'scientific_landscape' | 'scientific_landscape_2nd')` — internal; called by `[2ND]`/`[2ND_OFF]`

### `Keyset` type expansion
Add `'scientific_landscape_2nd'` alongside existing values. `CalcScreen` maps this to JSON keyset id.

---

## 3. CalcScreen changes

### New sentinel handling in `handleKeyPress`

```
[2ND]         → setKeyset('scientific_landscape_2nd')
[2ND_OFF]     → setKeyset('scientific_landscape')
[ANGLE_TOGGLE]→ toggleAngleMode()
ms            → memoryStore()
mr            → memoryRecall()
rand          → appendToExpression(String(Math.random().toFixed(9)))
```

### Runtime label patch for Rad/Deg key

Before building `configJson`, patch the `[ANGLE_TOGGLE]` key's caption in the keyset:

```ts
// find key with value '[ANGLE_TOGGLE]' in all rows, set caption to current angleMode.toUpperCase()
```

Pattern mirrors IssieVoice `getLanguageKeyLabel` / config patching in `loadKeyboardConfig`.

### `configJson` keyset selection

```
keyset === 'scientific' && landscape      → 'scientific_landscape'
keyset === 'scientific_landscape_2nd'    → 'scientific_landscape_2nd'
keyset === 'scientific' && !landscape    → 'scientific'
keyset === 'basic' && landscape          → 'basic_landscape'
keyset === 'basic' && !landscape         → 'basic'
```

---

## 4. Calculator.ts changes

### Signature change
```ts
evaluate(expression: string, angleMode: 'rad' | 'deg' = 'rad'): string
```

`CalcContext.computeResult` passes `angleMode`.

### New normalize rules

All substitutions happen before passing to `acEvaluate`. Functions unsupported by `advanced-calculator` are evaluated to their numeric result inline via regex substitution loop (innermost parens first).

**Constants (substituted before function expansion):**
- `e\^(` patterns handled as-is by `acEvaluate` via `^` operator — no substitution needed
- `\be\b` (bare `e`, not followed by `^`) → `2.718281828459045`
- `\bpi\b` → `3.14159265358979` (existing)

**Deg-mode trig wrapping** (when `angleMode === 'deg'`):
- `sin(x)` → `sin(x * 0.017453292519943)` (π/180 pre-multiplied)
- Same for `cos(`, `tan(`
- For inverse trig: result × `57.29577951308232` (180/π)

**New function substitutions** (evaluated by JS `Math`, not `acEvaluate`):
- `asin(n)` → computed value
- `acos(n)`, `atan(n)`
- `sinh(n)`, `cosh(n)`, `tanh(n)`
- `asinh(n)`, `acosh(n)`, `atanh(n)`
- `factorial(n)` → iterative factorial (integer only; non-integer → `Error`)
- `2root(n)` → `Math.sqrt(n)`
- `3root(n)` → `Math.cbrt(n)`
- `yroot(y)(n)` → `Math.pow(n, 1/y)` — requires parsing two args; sentinel design TBD (simplest: user types `n yroot( y )`, evaluated as `n^(1/y)` via regex)
- `logy(base)(n)` — similarly: `log(n)/log(base)`
- `log2(n)` → `Math.log2(n)`
- `x^2`, `x^3` → `^2`, `^3` (let `acEvaluate` handle via existing `^` operator)

**Substitution strategy:** single-pass regex for each function, matching balanced single-level paren content (no nested parens). For complex nested expressions, fallback to `Error`.

---

## 5. Out of scope

- Portrait scientific layout changes
- Android port (iOS first)
- `ʸ√x` and `logᵧ` full multi-arg parsing (keys present but evaluate to Error until UX is designed for two-step input)
- Copy result to clipboard
- 2nd key visual highlight style (plain implementation, style later)
