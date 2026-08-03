import { evaluate, negateLastNumber } from './Calculator';

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

const OPERATORS = /^[+\-*/^%]$/;
const FUNCTIONS_RE = /^(sin\(|cos\(|tan\(|asin\(|acos\(|atan\(|sinh\(|cosh\(|tanh\(|asinh\(|acosh\(|atanh\(|sqrt\(|ln\(|log\(|log2\(|2root\(|3root\(|factorial\(|x\^2|x\^3|x\^\(|2\^\(|1\/\()$/;
const FUNCTION_KEYS = new Set([
  'sin(', 'cos(', 'tan(', 'asin(', 'acos(', 'atan(',
  'sinh(', 'cosh(', 'tanh(', 'asinh(', 'acosh(', 'atanh(',
  'ln(', 'log(', 'log2(', '2root(', '3root(',
  'factorial(', 'sqrt(', 'e^(', '2^(', '10^(', '1/(',
]);

const TEMPLATE_KEYS = new Set(['yroot(', 'logy(', 'x^(']);
const TEMPLATE_KEY_TO_FN: Record<string, string> = { 'x^(': 'xpow(' };

// Suffix keys require a numeric operand already present — ignored otherwise
const SUFFIX_KEYS = new Set(['x^2', 'x^3', 'factorial(', '1/(']);

function endsWithValidOperand(expr: string): boolean {
  if (expr === '' || expr === '0') return true;
  return /[\d)]$/.test(expr);
}

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
  const numMatch = expr.match(/(-?\d+\.?\d*(?:[eE][+-]?\d+)?|pi|e)$/);
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

function insertIntoYSlot(expression: string, char: string): string {
  return expression.replace(TEMPLATE_MARKER, char + TEMPLATE_MARKER);
}

function ySlotContent(expression: string): string {
  // Use index-based extraction to handle ) chars in Y slot
  const markerIdx = expression.indexOf(TEMPLATE_MARKER);
  if (markerIdx === -1) return '';
  const commaIdx = expression.lastIndexOf(',', markerIdx);
  if (commaIdx === -1) return '';
  return expression.slice(commaIdx + 1, markerIdx);
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
    // Implicit multiplication: digit or ( after ) or constant → insert *
    const needsMul = (/[)]$/.test(state.expression) || /\b(pi|e)$/.test(state.expression))
      && /^[\d(]$/.test(val);
    expression = state.expression + (needsMul ? '*' : '') + val;
    resultMode = state.resultMode;
    result = state.result;
  }

  return { ...state, expression, result, resultMode };
}

export function dispatch(inState: CalcState, key: string): CalcState {
  let state = inState;

  // Template mode: route all input into the Y slot
  if (state.templateMode && isInTemplateMode(state.expression)) {
    if (key === 'AC') {
      return { ...state, expression: '', result: '', resultMode: false, templateMode: false };
    }
    if (key === '⌫') {
      const yContent = ySlotContent(state.expression);
      if (yContent === '') {
        // Restore X operand by extracting it from the template
        const templateMatch = state.expression.match(/^(.*?)\w+\(([^,]*),\x00\)(.*)$/);
        if (templateMatch) {
          const [, before, xOperand, after] = templateMatch;
          return { ...state, expression: before + xOperand + after, templateMode: false };
        }
        const withoutTemplate = state.expression.replace(/\w+\([^,]*,\x00\)/, '');
        return { ...state, expression: withoutTemplate, templateMode: false };
      }
      // Remove last char of Y slot
      const newExpr = state.expression.replace(
        new RegExp('(.)\\x00\\)$'),
        TEMPLATE_MARKER + ')'
      );
      return { ...state, expression: newExpr };
    }
    if (key === '=') {
      const finalized = finalizeTemplate(state.expression);
      const mode = state.keyset === 'basic' ? 'basic' : 'scientific';
      const res = evaluate(finalized, state.angleMode, mode);
      const finalRes = res === '' ? 'Error' : res;
      return { ...state, expression: finalized, result: finalRes, resultMode: true, templateMode: false };
    }
    const openParens = ySlotOpenParens(state.expression);
    if (openParens > 0) {
      // Inside parens: accept digits, operators, nested parens, decimal
      if (/^[\d.+\-*/^%()]$/.test(key)) {
        const newOpenParens = key === ')' ? openParens - 1 : (key === '(' ? openParens + 1 : openParens);
        const newExpr = insertIntoYSlot(state.expression, key);
        // Stay in template mode even after parens close — exit happens via operator or =
        return { ...state, expression: newExpr };
      }
    } else {
      // No open parens: only digits and decimal allowed; ( opens paren mode
      if (/^[\d.]$/.test(key)) {
        const newExpr = insertIntoYSlot(state.expression, key);
        return { ...state, expression: newExpr };
      }
      if (key === '(') {
        const newExpr = insertIntoYSlot(state.expression, key);
        return { ...state, expression: newExpr };
      }
      if (key === ')') {
        // ) with no open parens → exit template
        return { ...state, expression: finalizeTemplate(state.expression), templateMode: false };
      }
    }
    // Any other key — exit template mode, then re-dispatch
    const finalized = finalizeTemplate(state.expression);
    return dispatch({ ...state, expression: finalized, templateMode: false }, key);
  }

  if (key === 'AC') {
    return { ...state, expression: '', result: '', resultMode: false };
  }

  if (key === '⌫') {
    if (state.resultMode) {
      return { ...state, expression: '', result: '', resultMode: false };
    }
    return { ...state, expression: state.expression.slice(0, -1) };
  }

  if (key === '=') {
    const mode = state.keyset === 'basic' ? 'basic' : 'scientific';
    const res = evaluate(state.expression, state.angleMode, mode);
    const finalRes = res === '' ? 'Error' : res;
    return { ...state, result: finalRes, resultMode: true };
  }

  if (key === '+/-') {
    if (state.resultMode) {
      const negated = negateLastNumber(state.result);
      return { ...state, expression: negated, result: '', resultMode: false };
    }
    return { ...state, expression: negateLastNumber(state.expression) };
  }

  if (key === '[2ND]') {
    return { ...state, keyset: 'scientific_2nd' };
  }
  if (key === '[2ND_OFF]') {
    return { ...state, keyset: 'scientific' };
  }

  if (key === '[ANGLE_TOGGLE]') {
    const next = state.angleMode === 'rad' ? 'deg' : 'rad';
    return { ...state, angleMode: next };
  }

  if (key === 'ms') {
    const val = state.resultMode ? state.result : state.expression;
    if (val && val !== 'Error') {
      return { ...state, memory: val };
    }
    return state;
  }

  if (key === 'mr') {
    if (state.memory !== '0' || state.expression === '') {
      return appendToExpression(state, state.memory);
    }
    return state;
  }

  // rand — non-deterministic; caller must inject value, dispatch is a no-op
  if (key === 'rand') return state;

  // Suffix keys (x², x³, n!, x^() require expression ending with digit or )
  // When expression is empty (after AC), implicitly use 0 as the operand
  if (SUFFIX_KEYS.has(key)) {
    const base = state.resultMode ? state.result : state.expression;
    if (!endsWithValidOperand(base)) return state;
    if (base === '' || base === '0') {
      state = state.resultMode
        ? { ...state, expression: '0', result: '', resultMode: false }
        : { ...state, expression: '0' };
    }
  }

  // Template keys — enter two-arg input mode
  if (TEMPLATE_KEYS.has(key)) {
    const fn = TEMPLATE_KEY_TO_FN[key] ?? key;
    const baseExpr = state.resultMode ? state.result : state.expression;
    const baseState = state.resultMode
      ? { ...state, expression: '', result: '', resultMode: false }
      : state;
    const parts = extractTrailingOperand(baseExpr);
    let newExpr: string;
    if (parts) {
      const [before, operand] = parts;
      newExpr = `${before}${fn}${operand},${TEMPLATE_MARKER})`;
    } else {
      newExpr = `${baseExpr}${fn},${TEMPLATE_MARKER})`;
    }
    return { ...baseState, expression: newExpr, templateMode: true };
  }

  if (FUNCTION_KEYS.has(key)) {
    const baseExpr = state.resultMode ? state.result : state.expression;
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

  if (key) {
    return appendToExpression(state, key);
  }

  return state;
}
