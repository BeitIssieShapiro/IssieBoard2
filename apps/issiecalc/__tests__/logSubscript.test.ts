/**
 * A logarithm's base is a subscript. The log₂/log₁₀ keys carry that in their
 * captions, but the display rendered the raw value ("log2(5)").
 */
import { formatExpression } from '../src/services/formatExpression';

describe('log base renders as a subscript', () => {
  it.each([
    ['log2(5)', 'log₂(5)'],
    ['log(5)', 'log₁₀(5)'],
    // Mid-typing, before the argument is closed.
    ['log2(', 'log₂('],
    ['log(', 'log₁₀('],
    ['log2(5)+log(3)', 'log₂(5)+log₁₀(3)'],
  ])('%s → %s', (expr, expected) => {
    expect(formatExpression(expr)).toBe(expected);
  });

  it('leaves logy( for the template renderer', () => {
    // logᵧ is drawn by TEMPLATE_CONFIGS, which needs the raw form.
    expect(formatExpression('logy(8,2)')).toBe('logy(8,2)');
  });

  it('does not confuse log2( with a power of 2', () => {
    // The 2^( rule runs after, so the subscript is already in place.
    expect(formatExpression('log2(5)*2^(3)')).toBe('log₂(5)×2³');
  });
});
