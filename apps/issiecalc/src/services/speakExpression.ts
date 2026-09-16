/**
 * Turns a calculator expression into text for the speak button.
 *
 * Extracted from CalcScreen so it can be tested directly.
 */
import {
  getSubMap,
  speakableNumber,
  getLangWord,
  POSTFIX_FUNCTIONS,
  LANG_OF,
  MathLevel,
} from '../context/CalcTTSContext';

/**
 * Two-argument forms that dispatch writes for the template keys (xʸ, ʸ√, logᵧ).
 * They are what ends up in the expression after "=", and none of them appear in
 * the substitution map, so without this they tokenized down to their raw parens
 * and commas ("open parenthesis 2 3 close parenthesis").
 *
 * `render` receives the already-spoken argument text.
 */
const TEMPLATE_CALLS: Record<string, {
  /** Map key whose translation names this function. */
  nameKey: string;
  render: (x: string, y: string, name: string, of_: string) => string;
}> = {
  // 2 x^y 3 → "2 to the power 3"
  'xpow(': { nameKey: 'x^(', render: (x, y, name) => `${x} ${name} ${y}` },
  // yroot(x,y) is the y-th root of x → "y root of x"
  'yroot(': { nameKey: 'yroot(', render: (x, y, name, of_) => `${y} ${name} ${of_} ${x}` },
  // logy(x,y) is log base y of x → "log base y of x"
  'logy(': { nameKey: 'logy(', render: (x, y, name, of_) => `${name} ${y} ${of_} ${x}` },
};

const isPlainNumber = (s: string) => /^-?\d*\.?\d+$/.test(s.trim());

/** Splits "2,3" into its two arguments, respecting nested parens. */
function splitArgs(s: string): [string, string] | null {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) return [s.slice(0, i), s.slice(i + 1)];
  }
  return null;
}

/** Index of the `)` matching the `(` that ends at `openEnd`. */
function matchingClose(expr: string, openEnd: number): number {
  let depth = 1;
  for (let i = openEnd; i < expr.length; i++) {
    if (expr[i] === '(') depth++;
    else if (expr[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function speakExpression(
  expr: string,
  language: string | null,
  mathLevel?: MathLevel
): string {
  const ml = mathLevel ?? 'standard';
  const map = getSubMap(language, ml);
  // Tokenize: match known multi-char tokens first, then single chars
  const tokens = Object.keys(map).sort((a, b) => b.length - a.length);
  // A function token like `2root(` or `sin(` swallows its own open paren, so
  // it is never spoken. Speaking the matching `)` then sounds lopsided
  // ("square root 9 close parenthesis"). When such a call wraps nothing but a
  // plain number the parens carry no meaning aloud, so drop the `)` and read
  // it the way the per-key readout does — "cube root of 8" (CalcTTSContext's
  // WRAPPING_FUNCTIONS branch), with postfix functions putting the operand
  // first ("5 factorial"). Anything more complex (`sin(2+3)`) falls through to
  // plain tokenizing and keeps the `)`, where it marks where the argument
  // ends. User-typed `(` is never treated this way, so it reads as before.
  const of_ = getLangWord(LANG_OF, language);
  let result = '';
  let i = 0;
  while (i < expr.length) {
    let matched = false;

    // Two-argument template call: recurse into each argument so nested
    // expressions still read correctly.
    for (const call of Object.keys(TEMPLATE_CALLS)) {
      if (!expr.startsWith(call, i)) continue;
      const close = matchingClose(expr, i + call.length);
      if (close === -1) continue;
      const args = splitArgs(expr.slice(i + call.length, close));
      if (!args) continue;
      const { nameKey, render } = TEMPLATE_CALLS[call];
      const name = map[nameKey] ?? nameKey;
      const x = speakExpression(args[0], language, ml);
      const y = speakExpression(args[1], language, ml);
      result += ` ${render(x, y, name, of_)} `;
      i = close + 1;
      matched = true;
      break;
    }
    if (matched) continue;

    for (const token of tokens) {
      if (!expr.startsWith(token, i)) continue;

      // A function call wrapping a bare number is spoken as a whole phrase,
      // consuming the operand and its `)` here so neither is emitted again.
      if (token.endsWith('(') && token !== '(') {
        const close = expr.indexOf(')', i + token.length);
        const inner = close === -1 ? null : expr.slice(i + token.length, close);
        if (inner !== null && isPlainNumber(inner)) {
          const name = map[token];
          const operand = speakableNumber(inner.trim(), language);
          result += POSTFIX_FUNCTIONS.has(token)
            ? ` ${operand} ${name}`
            : ` ${name} ${of_} ${operand}`;
          i = close + 1;
          matched = true;
          break;
        }
      }
      // Padded both sides: without a trailing space a following digit runs
      // into the word ("plus1"), which some voices read as one token.
      result += ' ' + map[token] + ' ';
      i += token.length;
      matched = true;
      break;
    }
    if (!matched) {
      result += expr[i];
      i++;
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}
