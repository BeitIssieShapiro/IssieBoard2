/**
 * Reported: (2+3) then 2ˣ rendered as 2⁽²⁺³⁾ with a stray full-size ")"
 * trailing after the superscript.
 */
import { dispatch, CalcState } from '../src/services/calcDispatch';
import { evaluate } from '../src/services/Calculator';
import { matchTemplateCall } from '../src/services/templateCall';

const baseState: CalcState = {
  expression: '', result: '', resultMode: false,
  angleMode: 'deg', keyset: 'scientific', memory: '', templateMode: false,
};

describe('(2+3) then 2ˣ', () => {
  it('builds a power whose exponent is the parenthesised group', () => {
    let s = baseState;
    for (const k of ['(', '2', '+', '3', ')']) s = dispatch(s, k);
    expect(s.expression).toBe('(2+3)');
    s = dispatch(s, '2^(');
    expect(s.expression).toBe('xpow(2,(2+3))');
    expect(evaluate(s.expression, 'deg', 'scientific')).toBe('32');
  });

  it.each([
    // [expression, before, x, y, after] — "after" must stay empty, or a stray
    // ")" is drawn full-size beside the superscript.
    ['xpow(2,(2+3))', '', '2', '(2+3)', ''],
    ['xpow(2,5)', '', '2', '5', ''],
    ['xpow(10,(2+3))', '', '10', '(2+3)', ''],
    ['xpow(2,3)+1', '', '2', '3', '+1'],
    ['1+xpow(2,3)', '1+', '2', '3', ''],
    // Nested parens in either argument.
    ['xpow((1+1),(2*(3+4)))', '', '(1+1)', '(2*(3+4))', ''],
  ])('splits %s correctly', (expr, before, x, y, after) => {
    expect(matchTemplateCall(expr, 'xpow(')).toEqual([before, x, y, after]);
  });

  it('returns null when the call is incomplete', () => {
    expect(matchTemplateCall('xpow(2,3', 'xpow(')).toBeNull();
    expect(matchTemplateCall('5+3', 'xpow(')).toBeNull();
  });
});
