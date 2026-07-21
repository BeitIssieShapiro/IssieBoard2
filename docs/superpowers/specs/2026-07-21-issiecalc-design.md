# IssieCalc — Design Spec
_2026-07-21_

## Overview

IssieCalc is a new app in the IssieBoardNG project. It is an accessibility-first calculator that uses the existing native IssieBoard keyboard engine for input rendering. The native keyboard emits key values; all calculation logic runs in React Native.

Two modes: **Basic** (4-function + %, +/-) and **Scientific** (trig, sqrt, log, power, parens, π). Mode toggles via a key in the keyboard — no separate UI control needed.

Target users: same as IssieBoard — people with developmental or motor skill disabilities who benefit from large, configurable touch targets.

---

## 1. Keyboard Layout (`keyboards/calc.json`)

Single JSON file. Two keysets: `basic` and `scientific`.

All keys use plain `value` strings — no new native key types. The native keyboard emits values as-is; RN interprets them.

### Basic keyset

```
[ 7 ][ 8 ][ 9 ][ / ]
[ 4 ][ 5 ][ 6 ][ * ]
[ 1 ][ 2 ][ 3 ][ - ]
[ C ][ 0 ][ . ][ + ]
[ +/- ][ % ][ [SCI] ][ = ]
```

### Scientific keyset

```
[ sin( ][ cos( ][ tan( ][ / ]
[ x^2  ][ sqrt(][ log( ][ * ]
[ (    ][ )    ][ pi   ][ - ]
[ C    ][ 0    ][ .    ][ + ]
[ +/-  ][ %    ][ [BASIC] ][ = ]
```

### Value conventions

| Key | `value` | RN action |
|-----|---------|-----------|
| Digits, `.` | `"0"`–`"9"`, `"."` | Append to expression |
| Operators | `"+"`, `"-"`, `"*"`, `"/"` | Append to expression |
| Equals | `"="` | Evaluate expression |
| Clear | `"C"` | Clear expression and result |
| Percent | `"%"` | Append `"%"` |
| Negate | `"+/-"` | Wrap last number: `-(x)` |
| Functions | `"sin("`, `"cos("`, `"tan("`, `"sqrt("`, `"log("`, `"x^2"`, `"pi"`, `"("`, `")"` | Append to expression |
| Mode toggle | `"[SCI]"` / `"[BASIC]"` | Switch active keyset — no text inserted |

Bracket notation `[SCI]`/`[BASIC]` is the sentinel RN uses to detect mode-switch events without inserting them as text.

---

## 2. React Native App (`apps/issiecalc/`)

### Structure

```
apps/issiecalc/
  src/
    screens/
      CalcScreen.tsx        ← main screen, owns all UI and state wiring
    context/
      CalcContext.tsx        ← expression string + result string state
    services/
      Calculator.ts          ← pure evaluation logic
  App.tsx
  index.js
```

### Display

Two-zone layout above the keyboard:

```
┌──────────────────────────┐
│ expression (small, right-aligned, scrollable) │
│ result     (large, right-aligned)             │
└──────────────────────────┘
```

- Expression area: shows what the user has typed so far
- Result area: shows live result or `"Error"` on invalid expression
- On `=`: result becomes the new expression seed for chaining

### Key press handling (CalcScreen)

```
onKeyPress(value):
  "[SCI]"   → setKeyset("scientific")
  "[BASIC]" → setKeyset("basic")
  "C"       → clearAll()
  "="       → result = Calculator.evaluate(expression); freeze display
  "+/-"     → negateLastNumber(expression)
  default   → appendToExpression(value)
```

### Calculator.ts

Pure function, no side effects:

```ts
evaluate(expression: string): string
```

- Replaces `pi` → `Math.PI`, `x^2` → `**2` before eval
- Validates input: only digits, operators, parens, `.`, known function names — no arbitrary code paths
- Returns result string or `"Error"`

Uses `Function()` constructor with sanitized input (not raw `eval`). Input validated against allowlist regex before evaluation.

---

## 3. iOS Target (`ios/IssieCalc/`)

New Xcode target `IssieCalc` in `IssieBoardNG.xcodeproj`.

```
ios/IssieCalc/
  IssieCalc-Info.plist
```

- App type: React Native (same as IssieVoice)
- RN entry point: `apps/issiecalc/index.js`
- No new Swift code
- No new native modules
- Shares existing Podfile and pod dependencies with other targets

---

## 4. Out of Scope (this iteration)

- Android target (iOS first, port later per project convention)
- History / memory keys
- Copy-to-clipboard
- Theming / profile integration
- Haptics
