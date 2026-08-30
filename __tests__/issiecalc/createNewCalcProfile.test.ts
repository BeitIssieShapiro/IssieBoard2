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
