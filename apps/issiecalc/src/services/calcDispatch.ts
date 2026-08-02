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
