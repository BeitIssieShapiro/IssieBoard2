import {
  resolvePreviewBackground,
  isDefaultBackground,
  DEFAULT_PREVIEW_BACKGROUND,
  CALC_FALLBACK_BACKGROUND,
} from '../../src/utils/previewBackground';

describe('isDefaultBackground', () => {
  test('treats missing/empty/"default" as default', () => {
    expect(isDefaultBackground(undefined)).toBe(true);
    expect(isDefaultBackground(null)).toBe(true);
    expect(isDefaultBackground('')).toBe(true);
    expect(isDefaultBackground('   ')).toBe(true);
    expect(isDefaultBackground('default')).toBe(true);
    expect(isDefaultBackground('DEFAULT')).toBe(true);
  });

  test('treats a real color as not default', () => {
    expect(isDefaultBackground('#FFFFFF')).toBe(false);
    expect(isDefaultBackground('#1C1C1E')).toBe(false);
  });
});

describe('resolvePreviewBackground', () => {
  test('an explicit color always wins', () => {
    expect(resolvePreviewBackground('#FF0000', 'issiecalc', '#1C1C1E')).toBe('#FF0000');
    expect(resolvePreviewBackground('#FF0000', 'issieboard')).toBe('#FF0000');
  });

  // The reported bug: "default" in IssieCalc showed grey, but the app is black.
  test('default in issiecalc resolves to the calc host background, not grey', () => {
    expect(resolvePreviewBackground('default', 'issiecalc', '#1C1C1E')).toBe('#1C1C1E');
    expect(resolvePreviewBackground('default', 'issiecalc', '#1C1C1E'))
      .not.toBe(DEFAULT_PREVIEW_BACKGROUND);
  });

  test('missing/empty background in issiecalc behaves like default', () => {
    expect(resolvePreviewBackground(undefined, 'issiecalc', '#1C1C1E')).toBe('#1C1C1E');
    expect(resolvePreviewBackground('', 'issiecalc', '#1C1C1E')).toBe('#1C1C1E');
  });

  test('falls back to a known dark color if calc config omits a background', () => {
    expect(resolvePreviewBackground('default', 'issiecalc', undefined)).toBe(CALC_FALLBACK_BACKGROUND);
    expect(resolvePreviewBackground('default', 'issiecalc', 'default')).toBe(CALC_FALLBACK_BACKGROUND);
  });

  test('non-calc contexts keep the neutral grey backdrop', () => {
    expect(resolvePreviewBackground('default', 'issieboard')).toBe(DEFAULT_PREVIEW_BACKGROUND);
    expect(resolvePreviewBackground('default', 'issievoice')).toBe(DEFAULT_PREVIEW_BACKGROUND);
    expect(resolvePreviewBackground(undefined, undefined)).toBe(DEFAULT_PREVIEW_BACKGROUND);
  });
});

describe('calc config still declares a concrete background', () => {
  test('default_config.json background is a real color', () => {
    const calcConfig = require('../../ios/IssieCalc/default_config.json');
    expect(isDefaultBackground(calcConfig.backgroundColor)).toBe(false);
    expect(resolvePreviewBackground('default', 'issiecalc', calcConfig.backgroundColor))
      .toBe(calcConfig.backgroundColor);
  });
});
