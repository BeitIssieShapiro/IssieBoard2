/**
 * 10ˣ / 2ˣ / eˣ use the xpow( template, so the display shows a raised
 * exponent slot with a cursor instead of a flat "10^(2".
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { dispatch, CalcState, finalizeTemplate, readoutArgs } from '../src/services/calcDispatch';
import { speakExpression } from '../src/services/speakExpression';
import { evaluate } from '../src/services/Calculator';

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

describe('10ˣ / 2ˣ / eˣ as templates', () => {
  beforeEach(() => { spoken.length = 0; });

  it.each([
    // The number already typed becomes the exponent: 5 then 10ˣ → 10⁵.
    ['10^(', '10', '100000'],
    ['2^(', '2', '32'],
    ['e^(', 'e', '148.413159'],
  ])('%s raises its own base to the operand', (key, base, expected) => {
    const afterDigit = dispatch(baseState, '5');
    const s = dispatch(afterDigit, key);
    expect(s.expression).toBe(`xpow(${base},5)`);
    // The exponent is already known, so no slot is left open.
    expect(s.templateMode).toBe(false);
    expect(evaluate(s.expression, 'deg', 'scientific')).toBe(expected);
  });

  it('keeps what precedes the operand', () => {
    let s = dispatch(baseState, '2');
    s = dispatch(s, '+');
    s = dispatch(s, '3');
    s = dispatch(s, '10^(');
    expect(s.expression).toBe('2+xpow(10,3)');
    expect(evaluate(s.expression, 'deg', 'scientific')).toBe('1002');
  });

  it('renders via the xpow template, not a flat 10^(', () => {
    let s = dispatch(baseState, '5');
    s = dispatch(s, '10^(');
    // The renderer keys off this shape (HAS_TEMPLATE_FN / TEMPLATE_CONFIGS).
    expect(s.expression).toContain('xpow(');
    expect(s.expression).not.toContain('10^(');
  });

  it('reads the complete power when pressed, then the result', () => {
    jest.useFakeTimers();
    const ctx = mountTTS();
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language: 'en' }); });

    let s = dispatch(baseState, '5');
    const heard: Record<string, string[]> = {};
    for (const key of ['10^(', '=']) {
      const next = dispatch(s, key);
      spoken.length = 0;
      const args = readoutArgs(key, s, next);
      act(() => { ctx.readout(key, args.expression, args.result, next.angleMode); });
      act(() => { jest.advanceTimersByTime(3000); });
      heard[key] = [...spoken];
      s = next;
    }
    // The key announces the whole power, exponent included...
    expect(heard['10^(']).toEqual(['10 to the power 5']);
    // ...so "=" only needs the result.
    expect(heard['=']).toEqual(['equals', '100000']);
  });

  it('speak button reads the finished expression', () => {
    expect(speakExpression('xpow(10,5)', 'en')).toBe('10 to the power 5');
  });

  // 10 xʸ 3 builds the same xpow(10,3) that 3 then 10ˣ does, but here the
  // exponent was typed after the announcement and must still be spoken on "=".
  // The expression alone cannot tell the two cases apart.
  it('xʸ on a literal 10 still reads its exponent', () => {
    jest.useFakeTimers();
    const ctx = mountTTS();
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language: 'en' }); });

    let s = dispatch(baseState, '1');
    s = dispatch(s, '0');
    const heard: Record<string, string[]> = {};
    for (const key of ['x^(', '3', '=']) {
      const next = dispatch(s, key);
      spoken.length = 0;
      const args = readoutArgs(key, s, next);
      act(() => { ctx.readout(key, args.expression, args.result, next.angleMode); });
      act(() => { jest.advanceTimersByTime(3000); });
      heard[key] = [...spoken];
      s = next;
    }
    expect(heard['x^(']).toEqual(['10 to the power']);
    expect(heard['=']).toEqual(['3', 'equals', '1000']);
  });
});
