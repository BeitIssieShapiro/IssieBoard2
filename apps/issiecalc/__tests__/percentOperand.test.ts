/**
 * Reported: 5 % 6 = gave 0.0049…, because % evaluates to "/100" and the 6 was
 * glued on as "5/1006". % now closes its number: only an operator, "=" or ")"
 * may follow it.
 */
import { dispatch, CalcState, initialCalcState } from '../src/services/calcDispatch';

const baseState: CalcState = { ...initialCalcState, keyset: 'scientific' };

function play(keys: string[]): CalcState {
  return keys.reduce(dispatch, baseState);
}

describe('% closes its number', () => {
  it.each([
    ['a digit', '6'],
    ['a decimal point', '.'],
    ['an opening bracket', '('],
    ['a constant', 'pi'],
    ['memory recall', 'mr'],
    ['a function', 'sin('],
    ['a two-operand template', 'yroot('],
  ])('ignores %s after %%', (_, key) => {
    expect(play(['5', '%', key]).expression).toBe('5%');
  });

  it('5 % 6 = drops the 6 and gives 5 percent', () => {
    expect(play(['5', '%', '6', '=']).result).toBe('0.05');
  });

  it('accepts an operator after %, then the next number', () => {
    const state = play(['5', '0', '%', '*', '6', '=']);
    expect(state.expression).toBe('50%*6');
    expect(state.result).toBe('3');
  });

  it('accepts a closing bracket after %', () => {
    expect(play(['(', '5', '0', '%', ')']).expression).toBe('(50%)');
  });
});
