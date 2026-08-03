# IssieCalc Template Input (logy / yroot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement two-argument template input for `logy(` and `yroot(` — where X is the already-typed operand, and Y is entered after tapping the key, rendered as a live template with `_` cursor.

**Architecture:** The expression string uses a new internal marker `\x00` (null byte, never typed by user) to separate the X and Y arguments inside template functions: `yroot(90,\x00)` means "yroot of 90, Y slot active". `CalcState` gains a `templateMode` boolean. Digit and operator input routes to fill the Y slot. When Y input ends (non-digit outside parens, or `=`), the slot is finalized. Display renders the template with subscript/superscript formatting and a `_` cursor after current Y input.

**Tech Stack:** TypeScript, React Native `Text` with nested spans for subscript rendering.

## Global Constraints

- Marker character: `\x00` (null byte) — never appears in normal expressions
- Template functions: `yroot(` and `logy(` only
- `yroot(X,Y)` normalizes to `X^(1/Y)` in Calculator.ts
- `logy(X,Y)` normalizes to `log(X)/log(Y)` in Calculator.ts  
- Y slot accepts: digits, `.`, `(`, `)`, operators — same rules as normal expression but tracks open parens; exits when parens close or non-expression char received outside open parens
- `=` always finalizes Y slot and evaluates (auto-closes)
- `AC` / `⌫` work normally (backspace in Y slot removes last Y char, if Y empty removes whole template)
- No new dependencies

---

### Task 1: Add template state to `CalcState` and `calcDispatch.ts`

**Files:**
- Modify: `apps/issiecalc/src/services/calcDispatch.ts`

**Interfaces:**
- Produces:
  ```ts
  // CalcState gains:
  templateMode: boolean  // true when expression contains \x00 slot
  
  // New helpers exported:
  export function isInTemplateMode(expression: string): boolean
  export function finalizeTemplate(expression: string): string  // replaces \x00 with ''
  export const TEMPLATE_MARKER = '\x00'
  ```

- [ ] **Step 1: Add `templateMode` to `CalcState` and `initialCalcState`**

In `calcDispatch.ts`, update `CalcState`:
```ts
export interface CalcState {
  expression: string;
  result: string;
  resultMode: boolean;
  angleMode: 'rad' | 'deg';
  keyset: 'basic' | 'scientific' | 'scientific_2nd' | 'scientific_landscape_2nd';
  memory: string;
  templateMode: boolean;
}

export const initialCalcState: CalcState = {
  expression: '',
  result: '',
  resultMode: false,
  angleMode: 'rad',
  keyset: 'basic',
  memory: '0',
  templateMode: false,
};

export const TEMPLATE_MARKER = '\x00';

export function isInTemplateMode(expression: string): boolean {
  return expression.includes(TEMPLATE_MARKER);
}

export function finalizeTemplate(expression: string): string {
  return expression.replace(TEMPLATE_MARKER, '');
}
```

- [ ] **Step 2: Handle `yroot(` and `logy(` in `dispatch` — enter template mode**

Add these two keys to a `TEMPLATE_KEYS` set and handle them before `FUNCTION_KEYS`:

```ts
const TEMPLATE_KEYS = new Set(['yroot(', 'logy(']);
```

In `dispatch`, after the suffix key guard and before `FUNCTION_KEYS`:

```ts
if (TEMPLATE_KEYS.has(key)) {
  const baseExpr = state.resultMode ? state.result : state.expression;
  const baseState = state.resultMode
    ? { ...state, expression: '', result: '', resultMode: false }
    : state;
  const parts = extractTrailingOperand(baseExpr);
  let newExpr: string;
  if (parts) {
    const [before, operand] = parts;
    // e.g. yroot(90,\x00)
    newExpr = `${before}${key}${operand},${TEMPLATE_MARKER})`;
  } else {
    // No operand: yroot(,\x00) — X slot empty, still enter template mode
    newExpr = `${baseExpr}${key},${TEMPLATE_MARKER})`;
  }
  return { ...baseState, expression: newExpr, templateMode: true };
}
```

- [ ] **Step 3: Route digit/operator input through Y-slot logic in template mode**

Add a helper that inserts a character into the Y slot (just before `\x00`):

```ts
function insertIntoYSlot(expression: string, char: string): string {
  return expression.replace(TEMPLATE_MARKER, char + TEMPLATE_MARKER);
}

function ySlotContent(expression: string): string {
  const match = expression.match(/,([^)]*)\x00\)/);
  return match ? match[1] : '';
}

function ySlotOpenParens(expression: string): number {
  const content = ySlotContent(expression);
  let depth = 0;
  for (const c of content) {
    if (c === '(') depth++;
    else if (c === ')') depth--;
  }
  return Math.max(0, depth);
}
```

In `dispatch`, add at the top (before all other checks):

```ts
if (state.templateMode && isInTemplateMode(state.expression)) {
  // AC clears the whole expression including template
  if (key === 'AC') {
    return { ...state, expression: '', result: '', resultMode: false, templateMode: false };
  }
  // Backspace: remove last char before \x00, or if Y empty remove entire template
  if (key === '⌫') {
    const yContent = ySlotContent(state.expression);
    if (yContent === '') {
      // Remove the whole template function call — find the last function opener
      const withoutTemplate = state.expression.replace(/\w+\([^(]*,[^)]*\x00\)$/, '');
      return { ...state, expression: withoutTemplate, templateMode: false };
    }
    // Remove last char of Y slot
    const newExpr = state.expression.replace(
      new RegExp('(.)' + '\x00' + '\\)$'),
      TEMPLATE_MARKER + ')'
    );
    return { ...state, expression: newExpr };
  }
  // = finalizes Y slot and evaluates
  if (key === '=') {
    const finalized = finalizeTemplate(state.expression);
    const mode = state.keyset === 'basic' ? 'basic' : 'scientific';
    const res = evaluate(finalized, state.angleMode, mode);
    const finalRes = res === '' ? 'Error' : res;
    return { ...state, expression: finalized, result: finalRes, resultMode: true, templateMode: false };
  }
  // Digit, decimal, operator, ( — insert into Y slot
  if (/^[\d.+\-*/^%()]$/.test(key)) {
    const openParens = ySlotOpenParens(state.expression);
    const newExpr = insertIntoYSlot(state.expression, key);
    // If ) closes all open parens in Y slot → exit template mode
    const newOpenParens = key === ')' ? openParens - 1 : (key === '(' ? openParens + 1 : openParens);
    const exitTemplate = key === ')' && newOpenParens < 0;
    if (exitTemplate) {
      // Don't insert the ), instead finalize
      return { ...state, templateMode: false };
    }
    const stillInTemplate = newOpenParens >= 0;
    return { ...state, expression: newExpr, templateMode: stillInTemplate };
  }
  // Any other key (function, operator outside parens) — exit template mode first
  const finalized = finalizeTemplate(state.expression);
  const exitedState = { ...state, expression: finalized, templateMode: false };
  return dispatch(exitedState, key);
}
```

- [ ] **Step 4: Run tests — existing 111 should still pass (templateMode defaults false)**

```bash
npm test -- --testPathPattern=issiecalc --no-coverage
```

Expected: `111 passed`

- [ ] **Step 5: Add template mode dispatch tests**

Add to `__tests__/issiecalc/calcDispatch.test.ts`:

```ts
describe('template mode — yroot', () => {
  test('yroot( on 8 enters template mode', () => {
    const s = runSequence(['8', 'yroot(']);
    expect(s[1].templateMode).toBe(true);
    expect(s[1].expression).toContain('yroot(8,');
  });
  test('typing 3 in Y slot builds 8,3_', () => {
    const s = runSequence(['8', 'yroot(', '3']);
    expect(s[2].expression).toContain('3\x00');
  });
  test('8 yroot( 3 = gives cube root of 8 = 2', () => {
    const s = runSequence(['8', 'yroot(', '3', '=']);
    expect(s[3].result).toBe('2');
  });
  test('27 yroot( 3 = gives 3', () => {
    const s = runSequence(['2', '7', 'yroot(', '3', '=']);
    expect(s[4].result).toBe('3');
  });
  test('backspace with empty Y removes template', () => {
    const s = runSequence(['8', 'yroot(', '⌫']);
    expect(s[2].templateMode).toBe(false);
    expect(s[2].expression).toBe('8');
  });
  test('backspace removes last Y digit', () => {
    const s = runSequence(['8', 'yroot(', '3', '2', '⌫']);
    const yContent = s[4].expression.match(/,([^)]*)\x00\)/)?.[1];
    expect(yContent).toBe('3');
  });
  test('AC in template mode clears all', () => {
    const s = runSequence(['8', 'yroot(', '3', 'AC']);
    expect(s[3].expression).toBe('');
    expect(s[3].templateMode).toBe(false);
  });
});

describe('template mode — logy', () => {
  test('1000 logy( 10 = gives 3', () => {
    const s = runSequence(['1', '0', '0', '0', 'logy(', '1', '0', '=']);
    expect(s[7].result).toBe('3');
  });
  test('logy( on 100 enters template mode', () => {
    const s = runSequence(['1', '0', '0', 'logy(']);
    expect(s[3].templateMode).toBe(true);
  });
});
```

---

### Task 2: Implement `yroot` and `logy` in `Calculator.ts`

**Files:**
- Modify: `apps/issiecalc/src/services/Calculator.ts`

**Interfaces:**
- Consumes: expression strings like `yroot(8,3)`, `logy(1000,10)` (after template finalized, no `\x00`)
- Produces: correct numeric results via `normalize()`

- [ ] **Step 1: Add `yroot` and `logy` substitution to `normalize()`**

Add after the existing `mathFuncs` substitution loop:

```ts
// Two-arg functions: yroot(x,y) → x^(1/y), logy(x,y) → log(x)/log(y)
e = e.replace(/yroot\(([^,]+),([^)]+)\)/g, (_, x, y) => `(${x})^(1/(${y}))`);
e = e.replace(/logy\(([^,]+),([^)]+)\)/g, (_, x, y) => `log(${x})/log(${y})`);
```

- [ ] **Step 2: Add Calculator-level tests**

Add to `__tests__/issiecalc/calcDispatch.test.ts` under a new describe block:

```ts
describe('yroot and logy evaluation', () => {
  test('yroot(8,3) = 2', () => {
    const s = runSequence(['8', 'yroot(', '3', '=']);
    expect(s[3].result).toBe('2');
  });
  test('yroot(16,4) = 2', () => {
    const s = runSequence(['1', '6', 'yroot(', '4', '=']);
    expect(s[4].result).toBe('2');
  });
  test('logy(1000,10) = 3', () => {
    const s = runSequence(['1', '0', '0', '0', 'logy(', '1', '0', '=']);
    expect(s[7].result).toBe('3');
  });
  test('logy(8,2) = 3', () => {
    const s = runSequence(['8', 'logy(', '2', '=']);
    expect(s[3].result).toBe('3');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --testPathPattern=issiecalc --no-coverage
```

Expected: all pass including new template + eval tests.

---

### Task 3: Display rendering — template with subscript/superscript and `_` cursor

**Files:**
- Modify: `apps/issiecalc/src/screens/CalcScreen.tsx`

**Interfaces:**
- Consumes: `expression` containing `TEMPLATE_MARKER` (`\x00`), `templateMode` from `useCalc()`
- Produces: React Native JSX rendering the template with `_` cursor in Y slot

- [ ] **Step 1: Add `templateMode` to `useCalc()` destructure in `CalcScreen`**

```ts
const {
  expression, result, resultMode,
  appendToExpression, clearAll, backspace, computeResult, toggleSign,
  keyset, setKeyset,
  angleMode, toggleAngleMode,
  memory, memoryStore, memoryRecall,
  replaceExpression,
  templateMode,   // ADD THIS
} = useCalc();
```

- [ ] **Step 2: Add `renderTemplateExpression` function**

Add before `CalcScreen` component:

```ts
function renderTemplateExpression(
  expression: string,
  displayTextColor: string,
  dimColor: string
): React.ReactNode {
  // yroot(X,Y\x00) → ʸ√X where Y_ is the active slot
  const yrootMatch = expression.match(/^(.*)yroot\(([^,]+),([^\x00]*)\x00\)(.*)$/);
  if (yrootMatch) {
    const [, before, x, y, after] = yrootMatch;
    return (
      <>
        {before ? <Text style={{ color: displayTextColor }}>{formatExpression(before)}</Text> : null}
        <Text style={{ color: displayTextColor, fontSize: 28, lineHeight: 34 }}>
          <Text style={{ fontSize: 18, lineHeight: 28 }}>{y || ''}</Text>
          <Text style={{ color: dimColor, fontSize: 18, lineHeight: 28 }}>_</Text>
          {'√'}
          {formatExpression(x)}
        </Text>
        {after ? <Text style={{ color: displayTextColor }}>{formatExpression(after)}</Text> : null}
      </>
    );
  }
  // logy(X,Y\x00) → logY(X) where Y_ is the active slot
  const logyMatch = expression.match(/^(.*)logy\(([^,]+),([^\x00]*)\x00\)(.*)$/);
  if (logyMatch) {
    const [, before, x, y, after] = logyMatch;
    return (
      <>
        {before ? <Text style={{ color: displayTextColor }}>{formatExpression(before)}</Text> : null}
        <Text style={{ color: displayTextColor }}>
          {'log'}
          <Text style={{ fontSize: 18, lineHeight: 28 }}>{y || ''}</Text>
          <Text style={{ color: dimColor, fontSize: 18, lineHeight: 28 }}>_</Text>
          {'('}
          {formatExpression(x)}
          {')'}
        </Text>
        {after ? <Text style={{ color: displayTextColor }}>{formatExpression(after)}</Text> : null}
      </>
    );
  }
  return <Text style={{ color: displayTextColor }}>{formatExpression(expression) || '0'}</Text>;
}
```

- [ ] **Step 3: Use `renderTemplateExpression` in the main result display**

Replace the main result `Text` block:

```tsx
<Text style={[styles.result, { color: displayTextColor }]} numberOfLines={1}>
  {resultMode
    ? (result === 'NUMBER_TOO_BIG' ? strings.settings.numberTooBig : result)
    : templateMode
      ? renderTemplateExpression(expression, displayTextColor, dimTextColor)
      : (() => {
          const formatted = formatExpression(expression) || '0';
          const ghostCount = countUnclosedParens(expression);
          if (ghostCount === 0) return formatted;
          return (
            <>
              {formatted}
              <Text style={{ opacity: 0.3 }}>{')'.repeat(ghostCount)}</Text>
            </>
          );
        })()}
</Text>
```

- [ ] **Step 4: Build and test in simulator**

Reload Metro. Test:
- `8` → `yroot(` → display shows `_√8`
- Type `3` → display shows `3_√8`
- Press `=` → result `2`
- `1000` → `logy(` → display shows `log_(1000)`
- Type `10` → display shows `log10_(1000)`  
- Press `=` → result `3`

- [ ] **Step 5: Also update `CalcContext` to expose `templateMode`**

In `CalcContext.tsx`, add `templateMode` to the context value and expose it:

```ts
// In CalcContextValue interface:
templateMode: boolean;

// In CalcProvider, derive from expression:
const templateMode = expression.includes('\x00');

// In context value:
<CalcContext.Provider value={{
  ..., templateMode,
}}>
```

> Note: `templateMode` is derived from expression — no separate state needed in `CalcContext` since `calcDispatch` sets it and `replaceExpression` / `clearAll` sync it.
