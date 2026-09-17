/**
 * Reported, starting from a cleared display:
 *   2root      → shows "√(" and says "square root of 2 root"
 *   2root 9 =  → shows "√(9 = 3", the paren never closed
 */
import React from 'react';
import { create, act } from 'react-test-renderer';
import { dispatch, CalcState, readoutArgs } from '../src/services/calcDispatch';
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

/** Plays the keys, returning what each one spoke plus the final state. */
function play(keys: string[]): { heard: Record<string, string[]>; state: CalcState } {
  jest.useFakeTimers();
  const ctx = mountTTS();
  act(() => { ctx.loadFromConfig({ readoutMode: 'every-number', language: 'en' }); });

  const heard: Record<string, string[]> = {};
  let s = baseState;
  for (const key of keys) {
    const next = dispatch(s, key);
    spoken.length = 0;
    const args = readoutArgs(key, s, next);
    act(() => { ctx.readout(key, args.expression, args.result, next.angleMode); });
    act(() => { jest.advanceTimersByTime(3000); });
    heard[key] = [...spoken];
    s = next;
  }
  return { heard, state: s };
}

describe('2root pressed on a cleared display', () => {
  beforeEach(() => { spoken.length = 0; });

  it('announces the function without spelling out the call', () => {
    // Not "square root of 2root(".
    expect(play(['2root(']).heard['2root(']).toEqual(['square root']);
  });

  it('closes the paren on "=" so the display is not left half-open', () => {
    const { state } = play(['2root(', '9', '=']);
    expect(state.expression).toBe('2root(9)');
    expect(state.result).toBe('3');
  });

  it('reads "=" without leaking the raw call', () => {
    const { heard } = play(['2root(', '9', '=']);
    // The radicand is announced here because nothing said it earlier: the key
    // was pressed on an empty display, so its announcement had no operand.
    expect(heard['=']).toEqual(['9', 'equals', '3']);
    expect(heard['='].join(' ')).not.toContain('2root');
  });

  it.each([
    // The same call mid-expression, not just as the whole expression.
    ['5+2root(', 'square root'],
    ['2root(', 'square root'],
    ['3root(', 'cube root'],
  ])('%s announces only the name', (_expr, expected) => {
    const keys = _expr === '5+2root(' ? ['5', '+', '2root('] : [_expr];
    const { heard } = play(keys);
    expect(heard[keys[keys.length - 1]]).toEqual([expected]);
  });

  it('closes several open parens at once', () => {
    const { state } = play(['2root(', '(', '9', '=']);
    expect(state.expression).toBe('2root((9))');
    // NB: Calculator cannot evaluate a nested paren inside 2root( — it returns
    // Error for 2root((9)) even when fully closed. Pre-existing and separate
    // from the closing done here, which is why only the shape is asserted.
  });
});
