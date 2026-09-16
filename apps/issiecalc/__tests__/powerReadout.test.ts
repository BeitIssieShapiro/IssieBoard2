/**
 * Reported: 2 x^y 3 = reads "equals 8" (the exponent 3 is never spoken),
 * and the speak button then reads "open parenthesis 2 ... 3 close" with no
 * "to the power". Reproduces both against the real modules.
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { dispatch, CalcState, readoutArgs } from '../src/services/calcDispatch';
import { speakExpression } from '../src/services/speakExpression';

const spoken: string[] = [];
jest.mock('../../issievoice/src/services/TextToSpeech', () => ({
  __esModule: true,
  default: {
    initialize: () => Promise.resolve(),
    speak: (t: string) => { spoken.push(t); return Promise.resolve(); },
    setLanguage: () => Promise.resolve(),
    setVoice: () => Promise.resolve(),
    setRate: () => {},
    setPitch: () => {},
  },
}));

const { CalcTTSProvider, useCalcTTS } = require('../src/context/CalcTTSContext');

const baseState: CalcState = {
  expression: '', result: '', resultMode: false,
  angleMode: 'deg', keyset: 'scientific', memory: '', templateMode: false,
};

function mountTTS(): any {
  let ctx: any;
  const Probe = () => { ctx = useCalcTTS(); return null; };
  act(() => { create(React.createElement(CalcTTSProvider, null, React.createElement(Probe))); });
  return ctx;
}

/** Types 2, x^y, 3 and returns the state just before "=". */
function buildPower(): CalcState {
  let s = dispatch(baseState, '2');
  s = dispatch(s, 'x^(');
  return dispatch(s, '3');
}

describe('2 x^y 3 =', () => {
  beforeEach(() => { spoken.length = 0; });

  it('speaks the whole expression, not just the result', () => {
    jest.useFakeTimers();
    const ctx = mountTTS();
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language: 'en' }); });

    const before = buildPower();
    const args = readoutArgs('=', before, dispatch(before, '='));
    expect(args).toEqual({ expression: 'xpow(2,3)', result: '8' });

    act(() => { ctx.readout('=', args.expression, args.result, before.angleMode); });
    act(() => { jest.advanceTimersByTime(3000); });

    // The exponent must be audible somewhere before the result.
    expect(spoken.join(' ')).toContain('3');
    expect(spoken[spoken.length - 1]).toBe('8');
    expect(spoken).toEqual(['3', 'equals', '8']);
  });

  it('the speak button reads the power, not raw parens', () => {
    const before = buildPower();
    const expr = readoutArgs('=', before, dispatch(before, '=')).expression;
    expect(expr).toBe('xpow(2,3)');
    expect(speakExpression(expr, 'en')).toBe('2 to the power 3');
  });

  it.each([
    // yroot(x,y) = the y-th root of x; logy(x,y) = log base y of x.
    ['yroot(8,3)', '3 y root of 8'],
    ['logy(8,2)', 'log base y 2 of 8'],
    // Still readable when combined with ordinary operators/functions.
    ['xpow(2,3)+1', '2 to the power 3 plus 1'],
    ['xpow(2,3)*3root(27)', '2 to the power 3 times cube root of 27'],
  ])('speak button reads %s', (expr, expected) => {
    expect(speakExpression(expr, 'en')).toBe(expected);
  });
});
