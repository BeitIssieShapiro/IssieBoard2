import fs from 'fs';
import path from 'path';

/**
 * Deleting every keys-group must stick: the preview must stop applying them and
 * saving must persist "no groups".
 *
 * An empty styleGroups array is ambiguous on its own — it means either "this
 * profile keeps its groups in config.groups" (issiecalc, which must fall back)
 * or "the user deleted them all" (which must not). Falling back in the second
 * case brought every deleted group straight back and made save ignore the
 * deletion. `styleGroupsCleared` is what tells the two apart.
 */

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const CONTEXT = read('src/context/EditorContext.tsx');
const CANVAS = read('src/components/canvas/InteractiveCanvas.tsx');
const EDITOR = read('src/screens/EditorScreen.tsx');
const PANEL = read('src/components/toolbox/GlobalSettingsPanel.tsx');

/** The fallback rule, as written in each of the three places it appears. */
const resolve = (
  groupConfigsLen: number,
  styleGroupsLen: number,
  cleared: boolean,
  configGroups: string[],
) => (groupConfigsLen > 0 || styleGroupsLen > 0 || cleared ? [] : configGroups);

describe('the fallback rule', () => {
  const configGroups = ['operator', 'digit'];

  test('a profile that never had styleGroups still falls back (issiecalc)', () => {
    expect(resolve(0, 0, false, configGroups)).toEqual(configGroups);
  });

  test('deleting them all does NOT fall back', () => {
    expect(resolve(0, 0, true, configGroups)).toEqual([]);
  });

  test('groups that exist but are all disabled do not fall back', () => {
    // groupConfigs is empty (all inactive) but styleGroups is not.
    expect(resolve(0, 2, false, configGroups)).toEqual([]);
  });

  test('normal case: active groups are used', () => {
    expect(resolve(2, 2, false, configGroups)).toEqual([]);
  });
});

describe('styleGroupsCleared is maintained in the reducer', () => {
  test('it is part of the editor state and starts false', () => {
    expect(CONTEXT).toMatch(/styleGroupsCleared:\s*boolean/);
    expect(CONTEXT).toMatch(/styleGroupsCleared:\s*false/);
  });

  test('deleting the last group sets it', () => {
    const start = CONTEXT.indexOf("case 'DELETE_GROUP'");
    const body = CONTEXT.slice(start, CONTEXT.indexOf('case ', start + 10));
    expect(body).toMatch(/styleGroupsCleared:.*newGroups\.length === 0/s);
  });

  test('deleting one of several does not set it', () => {
    // The expression ORs with the previous value and checks the NEW length,
    // so it only latches when the list actually empties.
    const start = CONTEXT.indexOf("case 'DELETE_GROUP'");
    const body = CONTEXT.slice(start, CONTEXT.indexOf('case ', start + 10));
    const m = body.match(/styleGroupsCleared:\s*(.+),/);
    expect(m).toBeTruthy();
    const evaluate = (prev: boolean, newLen: number) =>
      new Function('state', 'newGroups', `return ${m![1]};`)(
        { styleGroupsCleared: prev },
        { length: newLen },
      );
    expect(evaluate(false, 3)).toBe(false); // deleted one, two remain
    expect(evaluate(false, 0)).toBe(true);  // deleted the last one
    expect(evaluate(true, 2)).toBe(true);   // stays latched after re-adding
  });

  test('loading a profile resets it', () => {
    const start = CONTEXT.indexOf("case 'SET_CONFIG'");
    const body = CONTEXT.slice(start, CONTEXT.indexOf('case ', start + 10));
    expect(body).toMatch(/styleGroupsCleared:\s*false/);
  });

  test('saving does not reset it — the groups really are gone', () => {
    const start = CONTEXT.indexOf("case 'MARK_SAVED'");
    const body = CONTEXT.slice(start, start + 200);
    expect(body).not.toContain('styleGroupsCleared');
  });
});

describe('every fallback site honours the flag', () => {
  test('the preview does', () => {
    expect(CANVAS).toMatch(/state\.styleGroups\.length > 0 \|\| state\.styleGroupsCleared/);
    // and re-renders when it changes
    expect(CANVAS).toMatch(/\[state\.config, state\.styleGroups, state\.styleGroupsCleared/);
  });

  test('save does', () => {
    expect(EDITOR).toMatch(/styleGroups\.length > 0 \|\| styleGroupsCleared/);
    // the flag is passed from the provider, where the state lives
    expect(EDITOR).toMatch(/onSave\(state\.config, state\.styleGroups, state\.styleGroupsCleared\)/);
  });

  test('the override warning does', () => {
    expect(PANEL).toMatch(/state\.styleGroups\.length > 0 \|\| state\.styleGroupsCleared/);
  });

  test('no fallback site was missed', () => {
    // Any remaining `config.groups || []` fallback must be guarded by the flag.
    for (const [name, src] of [['canvas', CANVAS], ['editor', EDITOR], ['panel', PANEL]] as const) {
      const idx = src.indexOf('config.groups || []');
      if (idx === -1) continue;
      const preceding = src.slice(Math.max(0, idx - 400), idx);
      expect(`${name}: ${preceding}`).toContain('styleGroupsCleared');
    }
  });
});
