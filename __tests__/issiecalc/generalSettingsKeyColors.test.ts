import fs from 'fs';
import path from 'path';

/**
 * IssieCalc styles its keys exclusively through keys-groups, so the General-tab
 * "Keys Background" / "Keys Text" swatches are meaningless there — they would be
 * reported as fully overridden every time. Both the swatches and the override
 * warning are hidden for issiecalc, and the analysis is skipped rather than
 * computed and discarded.
 */

const SRC = fs.readFileSync(
  path.join(__dirname, '../../src/components/toolbox/GlobalSettingsPanel.tsx'),
  'utf8',
);

describe('IssieCalc hides the key-colour controls', () => {
  test('the two key-colour pickers are gated behind showKeyColors', () => {
    expect(SRC).toMatch(/const showKeyColors\s*=\s*appContext\s*!==\s*'issiecalc'/);

    for (const handler of ['updateKeysBgColor', 'updateTextColor']) {
      const idx = SRC.indexOf(`onChange={${handler}}`);
      expect(idx).toBeGreaterThan(-1);
      // The nearest enclosing conditional before the picker must be showKeyColors.
      const before = SRC.slice(0, idx);
      expect(before.lastIndexOf('showKeyColors &&')).toBeGreaterThan(
        before.lastIndexOf('</View>\n\n              {/* Color Buttons Row */}'),
      );
    }
  });

  test('the keysBackground / keysText headers are gated too', () => {
    const headerRow = SRC.slice(
      SRC.indexOf('Header Row'),
      SRC.indexOf('Color Buttons Row'),
    );
    expect(headerRow).toContain('showKeyColors');
    // Background stays unconditional; the two key colours do not.
    const gated = headerRow.slice(headerRow.indexOf('showKeyColors'));
    expect(gated).toContain('keysBackground');
    expect(gated).toContain('keysText');
    const ungated = headerRow.slice(0, headerRow.indexOf('showKeyColors'));
    expect(ungated).toContain('globalSettings.background');
    expect(ungated).not.toContain('keysBackground');
  });

  test('the override analysis is skipped, not just hidden', () => {
    const start = SRC.indexOf('const overrideReports = useMemo');
    const end = SRC.indexOf('const warningTextFor', start);
    const body = SRC.slice(start, end);
    // Early-returns empty reports before calling analyzeGroupOverrides.
    const guardIdx = body.indexOf('if (!showKeyColors)');
    const analyzeIdx = body.indexOf('analyzeGroupOverrides(');
    expect(guardIdx).toBeGreaterThan(-1);
    expect(analyzeIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(analyzeIdx);
    expect(body).toContain('showKeyColors');
  });

  test('zeroed reports suppress both the badge and the warning', () => {
    // renderOverrideBadge and renderOverrideWarning both bail on maskedCount 0,
    // so the empty report is all that is needed to hide them.
    const badge = SRC.slice(
      SRC.indexOf('const renderOverrideBadge'),
      SRC.indexOf('const renderOverrideWarning'),
    );
    expect(badge).toMatch(/maskedCount === 0\) return null/);

    const warnStart = SRC.indexOf('const renderOverrideWarning');
    const warn = SRC.slice(warnStart, warnStart + 500);
    expect(warn).toMatch(/if \(!bg && !text\) return null/);

    const memo = SRC.slice(
      SRC.indexOf('const overrideReports = useMemo'),
      SRC.indexOf('const warningTextFor'),
    );
    expect(memo).toMatch(/maskedCount:\s*0/);
  });

  test('the empty report satisfies the OverrideReport shape', () => {
    const util = fs.readFileSync(
      path.join(__dirname, '../../src/utils/groupColorOverrides.ts'),
      'utf8',
    );
    const iface = util.slice(
      util.indexOf('export interface OverrideReport'),
      util.indexOf('}', util.indexOf('export interface OverrideReport')),
    );
    const required = [...iface.matchAll(/^\s{2}(\w+)\??:/gm)].map(m => m[1]);
    expect(required.length).toBeGreaterThan(0);

    const memo = SRC.slice(
      SRC.indexOf('const empty: OverrideReport'),
      SRC.indexOf('};', SRC.indexOf('const empty: OverrideReport')),
    );
    for (const field of required) {
      expect(memo).toContain(`${field}:`);
    }
  });
});
