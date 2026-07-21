function sanitize(expr: string): string {
  return expr
    .replace(/pi/g, String(Math.PI))
    .replace(/sin\(/g, 'Math.sin(')
    .replace(/cos\(/g, 'Math.cos(')
    .replace(/tan\(/g, 'Math.tan(')
    .replace(/sqrt\(/g, 'Math.sqrt(')
    .replace(/log\(/g, 'Math.log10(')
    .replace(/x\^2/g, '**2')
    .replace(/\^/g, '**')
    .replace(/%/g, '/100');
}

// Returns true if the expression is in an incomplete state and shouldn't be evaluated yet
export function isIncomplete(expression: string): boolean {
  const trimmed = expression.trim();
  if (!trimmed) return true;
  // Ends with an operator or opening paren
  return /[\+\-\*\/\(]$/.test(trimmed);
}

export function evaluate(expression: string): string {
  if (!expression || expression.trim() === '') return '0';
  if (isIncomplete(expression)) return '';
  try {
    const sanitized = sanitize(expression);
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${sanitized})`)();
    if (typeof result !== 'number' || !isFinite(result)) return 'Error';
    const rounded = parseFloat(result.toPrecision(12));
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
  return `${before}(-(${num}))`;
}
