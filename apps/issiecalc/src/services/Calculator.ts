import { evaluate as acEvaluate } from 'advanced-calculator';

// Normalize expression tokens to what advanced-calculator expects
function normalize(expression: string): string {
  return expression
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/x\^2/g, '^2')
    .replace(/sqrt\(/g, 'sqrt(')
    .replace(/sin\(/g, 'sin(')
    .replace(/cos\(/g, 'cos(')
    .replace(/tan\(/g, 'tan(')
    .replace(/log\(/g, 'log(')
    .replace(/\bpi\b/g, '3.14159265358979')
    .replace(/%/g, '/100');
}

// Returns '' when expression is incomplete (trailing operator/open paren)
function isIncomplete(expression: string): boolean {
  const trimmed = expression.trim();
  if (!trimmed) return true;
  return /[\+\-\*\/\(]$/.test(trimmed);
}

export function evaluate(expression: string): string {
  if (!expression || expression.trim() === '') return '0';
  if (isIncomplete(expression)) return '';
  try {
    const result = acEvaluate(normalize(expression));
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
  // Simple case: the entire expression is just a number
  if (!before.trim()) {
    return num.startsWith('-') ? num.slice(1) : '-' + num;
  }
  // After an operator: wrap with negation
  return `${before}(-${num})`;
}
