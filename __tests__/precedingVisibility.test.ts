import { resolveHiddenKeys, visibilityModeOf } from '../src/utils/precedingVisibility';

const ALL = ['a', 'b', 'c', 'd'];

const showOnly = (...members: string[]) => ({ members, style: { visibilityMode: 'showOnly' as const } });
const hide = (...members: string[]) => ({ members, style: { visibilityMode: 'hide' as const } });
const colorsOnly = (...members: string[]) => ({ members, style: { bgColor: '#333' } as any });

describe('visibilityModeOf', () => {
  test('reads visibilityMode when present', () => {
    expect(visibilityModeOf(showOnly('a'))).toBe('showOnly');
    expect(visibilityModeOf(hide('a'))).toBe('hide');
  });

  test('falls back to the legacy hidden boolean', () => {
    expect(visibilityModeOf({ members: ['a'], style: { hidden: true } })).toBe('hide');
    expect(visibilityModeOf({ members: ['a'], style: { hidden: false } })).toBe('default');
  });

  test('no style at all is default', () => {
    expect(visibilityModeOf({ members: ['a'] })).toBe('default');
  });
});

describe('resolveHiddenKeys', () => {
  test('no groups hides nothing', () => {
    expect(resolveHiddenKeys([], ALL).size).toBe(0);
  });

  test('a colours-only group does not affect visibility', () => {
    // The reported bug in reverse: colour groups must not dim anything.
    expect(resolveHiddenKeys([colorsOnly('a', 'b')], ALL).size).toBe(0);
  });

  test('showOnly hides everything it does not list', () => {
    // The reported bug: a preceding "show only a, b" must dim c and d.
    const hidden = resolveHiddenKeys([showOnly('a', 'b')], ALL);
    expect([...hidden].sort()).toEqual(['c', 'd']);
  });

  test('hide hides exactly its members', () => {
    const hidden = resolveHiddenKeys([hide('a')], ALL);
    expect([...hidden]).toEqual(['a']);
  });

  test('a later showOnly re-shows a key an earlier group hid', () => {
    const hidden = resolveHiddenKeys([hide('a'), showOnly('a', 'b')], ALL);
    expect(hidden.has('a')).toBe(false);
    expect([...hidden].sort()).toEqual(['c', 'd']);
  });

  test('a later hide overrides an earlier showOnly for that key', () => {
    // showOnly(a,b) shows a and b; the later hide(b) then hides b again.
    const hidden = resolveHiddenKeys([showOnly('a', 'b'), hide('b')], ALL);
    expect([...hidden].sort()).toEqual(['b', 'c', 'd']);
  });

  test('two showOnly groups: the later one wins outright', () => {
    const hidden = resolveHiddenKeys([showOnly('a'), showOnly('d')], ALL);
    expect([...hidden].sort()).toEqual(['a', 'b', 'c']);
  });

  test('keys outside the known set are still hidden by an explicit hide', () => {
    // `hide` names its members directly, so it does not depend on allValues.
    const hidden = resolveHiddenKeys([hide('z')], ALL);
    expect(hidden.has('z')).toBe(true);
  });

  test('essential keys are excluded by the caller, not here', () => {
    // allValues is the caller's filtered set; anything absent is never dimmed
    // by a showOnly rule.
    const hidden = resolveHiddenKeys([showOnly('a')], ['a', 'b']);
    expect([...hidden]).toEqual(['b']);
    expect(hidden.has('space')).toBe(false);
  });
});
