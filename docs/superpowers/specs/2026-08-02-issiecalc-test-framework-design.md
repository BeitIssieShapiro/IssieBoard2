---
name: issiecalc-test-framework
description: Test framework for IssieCalc — pure dispatch function extracted from CalcScreen + 100 key-sequence tests
metadata:
  type: project
---

# IssieCalc Test Framework

## Goal

Validate that tap sequences in IssieCalc produce correct intermediate expression state and final results. Tests run in Jest with no device, no native code, no React mounting.

## State Model

```ts
interface CalcState {
  expression: string;
  result: string;
  resultMode: boolean;
  angleMode: 'rad' | 'deg';
  keyset: 'basic' | 'scientific' | 'scientific_2nd' | 'scientific_landscape_2nd';
  memory: string;
}
```

## Pure Dispatch Function

**New file:** `apps/issiecalc/src/services/calcDispatch.ts`

```ts
function dispatch(state: CalcState, key: string): CalcState
```

This function contains all logic currently in `CalcScreen.handleKeyPress` plus the `CalcContext` mutations it triggers. It is pure: no side effects, no async, no React.

Key mapping (from `CalcScreen.handleKeyPress`):
- `⌫` → backspace
- `AC` → clearAll
- `=` → computeResult
- `+/-` → toggleSign
- `[2ND]` / `[2ND_OFF]` → setKeyset
- `[ANGLE_TOGGLE]` → toggleAngleMode
- `ms` / `mr` → memoryStore / memoryRecall
- Function keys (`sqrt(`, `sin(`, etc.) → wrap trailing operand + auto-close paren
- Everything else → appendToExpression

## CalcScreen Change

`handleKeyPress` becomes a thin wrapper:

```ts
const handleKeyPress = (event: KeyPressEvent) => {
  const newState = dispatch(currentState, event.nativeEvent.value);
  applyState(newState);                // calls useCalc() setters
  readout(event.nativeEvent.value, newState.expression, newState.result);
};
```

`currentState` is derived from `useCalc()` values. No logic lives in the component.

## Test Helper

```ts
function runSequence(keys: string[], initial?: Partial<CalcState>): CalcState[]
```

Returns one `CalcState` snapshot per tap. Tests assert on any snapshot by index or on the final one.

Example:

```ts
const states = runSequence(['1', '+', '2', 'sqrt(', '=']);
expect(states[2].expression).toBe('1+2');
expect(states[3].expression).toBe('1+sqrt(2)');
expect(states[4].result).toBe('2.41421356237');
expect(states[4].resultMode).toBe(true);
```

## Test File

`apps/issiecalc/src/services/__tests__/calcDispatch.test.ts`

~100 test cases covering:

| Category | Examples |
|----------|---------|
| Basic arithmetic | `1+2=`, `9/3=`, `5*5=` |
| Operator chaining | `1+2+3=`, `2*3+4=` |
| Result continuation | `5= +3=` (operator after result), `5= 6=` (digit after result resets) |
| Function wrapping | `4 sqrt(` → `sqrt(4)`, `2 sqrt( =` → `1.41...` |
| Trig (rad/deg) | `sin(0)=`, `cos(0)=` in both angle modes |
| Nested functions | `sqrt( sin(` chains |
| `+/-` | on expression, on result |
| `AC` / `⌫` | mid-expression, after result |
| Memory | `5 ms 3 + mr =` → `8` |
| Error states | `1/0=`, incomplete expression `1+=` |
| Large numbers basic | result ≥ 1e12 → `NUMBER_TOO_BIG` |
| E-notation scientific | result ≥ 1e9 in scientific mode → `1E+9` format |
| Factorial | `5 factorial( =` → `120` |
| Constants | `pi *2=`, `e^1=` |
| Percent | `50%=` → `0.5` |

## Files Changed

| File | Change |
|------|--------|
| `apps/issiecalc/src/services/calcDispatch.ts` | **New** — pure dispatch function |
| `apps/issiecalc/src/services/__tests__/calcDispatch.test.ts` | **New** — 100 test cases |
| `apps/issiecalc/src/screens/CalcScreen.tsx` | `handleKeyPress` delegates to `dispatch` |
