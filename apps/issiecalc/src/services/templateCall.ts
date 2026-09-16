/**
 * Splits a finished two-argument template call into [before, x, y, after].
 *
 * A regex cannot do this: the arguments may contain parens of their own, so
 * `[^)]+` stops at the first one — `xpow(2,(2+3))` yielded y="(2+3" and left a
 * stray ")" to be drawn full-size after the superscript. This counts depth to
 * find the call's real closing paren.
 *
 * Lives outside CalcScreen so it can be tested without loading React Native.
 */
export function matchTemplateCall(
  expression: string,
  fn: string
): [string, string, string, string] | null {
  const start = expression.indexOf(fn);
  if (start === -1) return null;
  const argsFrom = start + fn.length;
  let depth = 1;
  let comma = -1;
  for (let i = argsFrom; i < expression.length; i++) {
    const c = expression[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) {
        if (comma === -1) return null;
        return [
          expression.slice(0, start),
          expression.slice(argsFrom, comma),
          expression.slice(comma + 1, i),
          expression.slice(i + 1),
        ];
      }
    } else if (c === ',' && depth === 1 && comma === -1) {
      comma = i;
    }
  }
  return null;
}
