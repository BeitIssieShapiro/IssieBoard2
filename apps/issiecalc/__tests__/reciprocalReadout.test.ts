/**
 * Reported: 7 then 1/x shows (1÷7) but reads nothing, and the speak button
 * says "one over of seven" (a doubled preposition).
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

describe('7 then 1/x', () => {
  beforeEach(() => { spoken.length = 0; });

  /** Presses 7 then 1/x, returning what the keypress spoke. */
  function pressReciprocal(language: string): { expression: string; spoke: string[] } {
    jest.useFakeTimers();
    const ctx = mountTTS();
    act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language }); });

    const s = dispatch(baseState, '7');
    const next = dispatch(s, '1/(');
    spoken.length = 0;
    const args = readoutArgs('1/(', s, next);
    act(() => { ctx.readout('1/(', args.expression, args.result, next.angleMode); });
    act(() => { jest.advanceTimersByTime(3000); });
    return { expression: next.expression, spoke: [...spoken] };
  }

  it('reads the key instead of staying silent', () => {
    const { expression, spoke } = pressReciprocal('en');
    expect(expression).toBe('1/(7)');
    expect(spoke).toEqual(['1 over 7']);
  });

  it.each([
    ['he', '1 חלקי 7'],
    ['ar', '1 على 7'],
  ])('reads in %s without a doubled preposition', (language, expected) => {
    expect(pressReciprocal(language).spoke).toEqual([expected]);
  });

  it.each([
    // "1 over 7", never "1 over of 7".
    ['1/(7)', 'en', '1 over 7'],
    ['1/(7)', 'he', '1 חלקי 7'],
    ['1/(7)', 'ar', '1 على 7'],
    ['1/(7)+2', 'en', '1 over 7 plus 2'],
  ])('speak button reads %s in %s', (expr, language, expected) => {
    expect(speakExpression(expr, language)).toBe(expected);
  });
});
