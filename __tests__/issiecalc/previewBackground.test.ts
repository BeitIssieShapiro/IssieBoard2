import {
  resolvePreviewBackground,
  resolveCalcDisplayBackground,
  resolveCalcDisplayTextColor,
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

/**
 * calcDisplayBgColor colours everything above the keyboard (top bar + display).
 * It must default to the keyboard background so calculators created before the
 * setting existed are visually unchanged.
 */
describe('resolveCalcDisplayBackground', () => {
  test('unset falls back to the keyboard background', () => {
    expect(resolveCalcDisplayBackground(undefined, '#1C1C1E')).toBe('#1C1C1E');
    expect(resolveCalcDisplayBackground('', '#1C1C1E')).toBe('#1C1C1E');
    expect(resolveCalcDisplayBackground('default', '#1C1C1E')).toBe('#1C1C1E');
  });

  test('an explicit colour wins over the keyboard background', () => {
    expect(resolveCalcDisplayBackground('#FFF8E1', '#1C1C1E')).toBe('#FFF8E1');
  });

  test('the two backgrounds are independent', () => {
    // Light display over a dark keyboard, and the reverse.
    expect(resolveCalcDisplayBackground('#FFFFFF', '#000000')).toBe('#FFFFFF');
    expect(resolveCalcDisplayBackground('#000000', '#FFFFFF')).toBe('#000000');
  });
});

describe('resolveCalcDisplayTextColor', () => {
  test('an explicit display colour is used as-is', () => {
    expect(resolveCalcDisplayTextColor('#FF0000', '#FFFFFF')).toBe('#FF0000');
  });

  test('unset picks a contrasting colour against the display background', () => {
    // The regression this guards: contrast must be measured against the display
    // background, not the keyboard's, or a light display gets white-on-white.
    expect(resolveCalcDisplayTextColor('', '#FFF8E1')).toBe('#000000');
    expect(resolveCalcDisplayTextColor('', '#101820')).toBe('#FFFFFF');
    expect(resolveCalcDisplayTextColor(undefined, '#FFFFFF')).toBe('#000000');
    expect(resolveCalcDisplayTextColor('default', '#000000')).toBe('#FFFFFF');
  });

  test('a non-hex background falls back to white text', () => {
    expect(resolveCalcDisplayTextColor('', 'rgba(0,0,0,0.5)')).toBe('#FFFFFF');
  });

  test('an untouched calculator is unchanged end to end', () => {
    const calcConfig = require('../../ios/IssieCalc/default_config.json');
    const kb = calcConfig.backgroundColor;
    const display = resolveCalcDisplayBackground(calcConfig.calcDisplayBgColor, kb);
    expect(display).toBe(kb);
    expect(resolveCalcDisplayTextColor(calcConfig.calcDisplayColor, display))
      .toBe(calcConfig.calcDisplayColor);
  });
});
