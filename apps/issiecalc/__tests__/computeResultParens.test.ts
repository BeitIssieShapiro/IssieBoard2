/**
 * Reported: √(2 = 1.41… — "=" left the paren open on screen.
 *
 * Exercises CalcContext, not dispatch: the screen calls computeResult() for
 * "=", so a fix verified only against dispatch never reached the display.
 */
import React from 'react';
import { create, act } from 'react-test-renderer';

jest.mock('../../../src/native/KeyboardPreferences', () => ({
  __esModule: true,
  default: {
    getString: () => Promise.resolve(null),
    setString: () => Promise.resolve(),
  },
}));

const { CalcProvider, useCalc } = require('../src/context/CalcContext');

/** Mounts the provider and returns a live handle to its context value. */
function mountCalc(): () => any {
  let ctx: any;
  const Probe = () => { ctx = useCalc(); return null; };
  act(() => { create(React.createElement(CalcProvider, null, React.createElement(Probe))); });
  return () => ctx;
}

describe('computeResult closes open parens', () => {
  it('√(2 = shows √(2) on screen, not √(2', () => {
    const calc = mountCalc();
    act(() => { calc().appendToExpression('2root('); });
    act(() => { calc().appendToExpression('2'); });
    expect(calc().expression).toBe('2root(2');

    act(() => { calc().computeResult(); });
    // The paren the result was computed with is now visible in the expression.
    expect(calc().expression).toBe('2root(2)');
    expect(calc().result).toBe('1.41421356');
    expect(calc().resultMode).toBe(true);
  });

  it('leaves an already-closed expression untouched', () => {
    const calc = mountCalc();
    act(() => { calc().replaceExpression('2root(9)'); });
    act(() => { calc().computeResult(); });
    expect(calc().expression).toBe('2root(9)');
    expect(calc().result).toBe('3');
  });

  it('closes several at once', () => {
    const calc = mountCalc();
    act(() => { calc().replaceExpression('sin((30'); });
    act(() => { calc().computeResult(); });
    expect(calc().expression).toBe('sin((30))');
  });

  it('reports Error without mangling the expression', () => {
    const calc = mountCalc();
    act(() => { calc().replaceExpression('2root('); });
    act(() => { calc().computeResult(); });
    expect(calc().result).toBe('Error');
  });
});
