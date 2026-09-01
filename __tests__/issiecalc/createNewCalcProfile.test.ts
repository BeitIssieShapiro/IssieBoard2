import fs from 'fs';
import path from 'path';

/**
 * Regression test for: "create new keyboard/calculator -> failed on save".
 *
 * Root cause: handleCreateNew called buildConfiguration() unconditionally.
 * buildConfiguration throws `Keyboard "calc" not found` because KEYBOARDS only
 * contains the language keyboards (en/he/ar + ordered variants). Every other
 * issiecalc code path bypasses buildConfiguration; handleCreateNew did not.
 */

const SRC = fs.readFileSync(
  path.join(__dirname, '../../src/screens/EditorScreen.tsx'),
  'utf8',
);

function extractKeyboardsMapKeys(): string[] {
  const m = SRC.match(
    /const KEYBOARDS: Record<string, KeyboardDefinition> = \{([\s\S]*?)\n\};/,
  );
  if (!m) throw new Error('KEYBOARDS map not found in EditorScreen.tsx');
  return [...m[1].matchAll(/'([^']+)'\s*:/g)].map(x => x[1]);
}

function extractHandleCreateNew(): string {
  const start = SRC.indexOf('const handleCreateNew = useCallback');
  if (start === -1) throw new Error('handleCreateNew not found');
  const end = SRC.indexOf('}, [appContext]);', start);
  if (end === -1) throw new Error('end of handleCreateNew not found');
  return SRC.slice(start, end);
}

describe('creating a new calc profile', () => {
  test('KEYBOARDS has no "calc" entry, so buildConfiguration would throw for it', () => {
    const keys = extractKeyboardsMapKeys();
    expect(keys).not.toContain('calc');
  });

  test('handleCreateNew must branch on issiecalc before building a config', () => {
    const body = extractHandleCreateNew();
    expect(body).toContain('issiecalc');
  });

  test('handleCreateNew must not call buildConfiguration unguarded for calc', () => {
    const body = extractHandleCreateNew();
    const callsBuild = body.includes('buildConfiguration(');
    if (callsBuild) {
      // If it still calls buildConfiguration, that call must be preceded by an
      // issiecalc early-return guard.
      const guardIdx = body.indexOf('issiecalc');
      const buildIdx = body.indexOf('buildConfiguration(');
      expect(guardIdx).toBeGreaterThan(-1);
      expect(guardIdx).toBeLessThan(buildIdx);
    }
  });

  test('errors during profile creation are logged, not silently swallowed', () => {
    const start = SRC.indexOf('const handleCreateNewProfile = useCallback');
    const end = SRC.indexOf('}, [onCreateNew', start);
    const body = SRC.slice(start, end);
    expect(body).toMatch(/console\.(error|warn)/);
  });
});

/**
 * A brand-new calculator must start fresh: none of the base config's style
 * groups are carried over. Only cloning copies existing styling.
 */
describe('a new calc profile starts with no style groups', () => {
  test('handleCreateNew does not seed groups from the base config', () => {
    const body = extractHandleCreateNew();
    // The calc branch must not rebuild style groups out of baseConfig.groups.
    expect(body).not.toMatch(/baseConfig\.groups\s*\|\|\s*\[\]\)?\s*\n?\s*\.filter/);
    expect(body).not.toContain('groups: baseConfig.groups');
  });

  test('the created profile def and style groups are both empty', () => {
    const body = extractHandleCreateNew();
    const calcBranch = body.slice(body.indexOf('issiecalc'));
    expect(calcBranch).toMatch(/const styleGroups:\s*any\[\]\s*=\s*\[\]/);
    expect(calcBranch).toMatch(/groups:\s*\[\]/);
  });

  /**
   * The calc branch builds its config as { ...baseConfig, ...calcProfileDef },
   * so the base config's colors (#1C1C1E / #2C2C2E / #FFFFFF) leak through
   * unless the new profile explicitly overrides them.
   */
  test('colors are reset rather than inherited from the base config', () => {
    const body = extractHandleCreateNew();
    const calcBranch = body.slice(body.indexOf('issiecalc'));
    // Must be '' (SYSTEM_DEFAULT_COLOR), not the literal 'default': the picker
    // only treats '' as its default selection, and rendering a 'default' string
    // as a color falls back to white.
    expect(calcBranch).toMatch(/backgroundColor:\s*''/);
    expect(calcBranch).toMatch(/keysBgColor:\s*''/);
    expect(calcBranch).toMatch(/textColor:\s*''/);
    expect(calcBranch).toMatch(/calcDisplayColor:\s*''/);
    expect(calcBranch).not.toMatch(
      /(backgroundColor|keysBgColor|textColor|calcDisplayColor):\s*'default'/,
    );
  });

  /**
   * Every colour the base config defines must be reset, or it leaks through the
   * { ...baseConfig, ...calcProfileDef } spread.
   */
  test('no colour field from the base config survives the spread', () => {
    const base = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../../ios/IssieCalc/default_config.json'),
        'utf8',
      ),
    );
    const colourFields = Object.keys(base).filter(k =>
      /color/i.test(k) && typeof base[k] === 'string',
    );
    const calcBranch = extractHandleCreateNew().slice(
      extractHandleCreateNew().indexOf('issiecalc'),
    );
    for (const field of colourFields) {
      expect(calcBranch).toMatch(new RegExp(`${field}:\\s*''`));
    }
  });

  test("the reset value is what CompactColorPicker shows as the default selection", () => {
    const picker = fs.readFileSync(
      path.join(__dirname, '../../src/components/shared/CompactColorPicker.tsx'),
      'utf8',
    );
    // The value written at creation must satisfy isSystemDefaultSelected.
    expect(picker).toMatch(/SYSTEM_DEFAULT_COLOR\s*=\s*''/);
    const m = picker.match(/const isSystemDefaultSelected\s*=\s*(.+);/);
    expect(m).toBeTruthy();
    const check = new Function('value', 'SYSTEM_DEFAULT_COLOR', `return ${m![1]};`);
    expect(check('', '')).toBe(true);
  });

  test("the renderer treats '' and 'default' as unset for both key colors", () => {
    const swift = fs.readFileSync(
      path.join(__dirname, '../../ios/Shared/KeyboardRenderer.swift'),
      'utf8',
    );
    for (const fn of ['getDefaultTextColor', 'getDefaultKeyBgColor']) {
      const start = swift.indexOf(`private func ${fn}()`);
      expect(start).toBeGreaterThan(-1);
      const body = swift.slice(start, start + 400);
      expect(body).toContain('.isEmpty');
      expect(body).toContain('"default"');
    }
  });
});

/**
 * EditorProvider only reads initialConfig/initialStyleGroups as the reducer's
 * lazy initial state, and is never re-keyed. Updating those props after creation
 * therefore does nothing to the mounted editor, so the toolbox and preview kept
 * showing the previous profile's groups until settings were closed and reopened.
 * Creation must push the new config into the live editor state instead.
 */
describe('a new profile resets the live editor state immediately', () => {
  test('onCreateNew returns the created config so the inner screen can apply it', () => {
    const m = SRC.match(/^\s*onCreateNew:.*$/m);
    expect(m).toBeTruthy();
    expect(m![0]).not.toContain('Promise<void>');
    expect(m![0]).toContain('newConfig');
  });

  test('both handleCreateNew branches return the created config', () => {
    const body = extractHandleCreateNew();
    // Calc branch early-return plus the language-keyboard path at the end.
    const returns = [...body.matchAll(/return\s*\{\s*newConfig:/g)];
    expect(returns.length).toBeGreaterThanOrEqual(1);
    // The calc branch must not bail out with a bare `return;`.
    const calcBranch = body.slice(body.indexOf('issiecalc'));
    expect(calcBranch).not.toMatch(/\n\s*return;\s*\n/);
  });

  test('handleCreateNewProfile pushes the new config into the editor context', () => {
    const start = SRC.indexOf('const handleCreateNewProfile = useCallback');
    const end = SRC.indexOf('}, [onCreateNew', start);
    const body = SRC.slice(start, end);
    expect(body).toContain('setConfig(');
    expect(body).toMatch(/await onCreateNew\(/);
  });
});

/**
 * Loading must distinguish "never stored style groups" (legacy profiles, which
 * still fall back to the base config) from "explicitly stored an empty list"
 * (a new calculator). Keying the fallback off array length conflates the two
 * and resurrects the built-in groups on the next load.
 */
describe('an explicitly empty style-group list survives a reload', () => {
  test('loadProfileById reports whether style groups were stored', () => {
    const start = SRC.indexOf('const loadProfileById = async');
    const end = SRC.indexOf('type AppContext', start);
    const body = SRC.slice(start, end);
    expect(body).toContain('hasStoredStyleGroups');
  });

  test('calc profile load does not fall back based on array length', () => {
    const start = SRC.indexOf("if (appContext === 'issiecalc') {", SRC.indexOf('const loaded = await loadProfileById(profile.id)'));
    const body = SRC.slice(start, start + 1200);
    expect(body).toContain('loaded.hasStoredStyleGroups');
    expect(body).not.toMatch(/loaded\.styleGroups\.length\s*>\s*0/);
  });

  test('startup restore does not fall back based on array length', () => {
    // Anchor on the startup path, which reads the active profile's stored
    // _styleGroups (the discard path earlier in the file is a different site).
    const idx = SRC.indexOf('const savedStyleGroupsJson = await KeyboardPreferences.getProfile');
    expect(idx).toBeGreaterThan(-1);
    const body = SRC.slice(idx - 400, idx + 1200);
    expect(body).toContain('hasStoredStyleGroups');
    expect(body).not.toMatch(/restoredStyleGroups\.length\s*===\s*0/);
  });
});
