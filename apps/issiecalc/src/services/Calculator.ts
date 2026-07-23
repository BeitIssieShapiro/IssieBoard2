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
