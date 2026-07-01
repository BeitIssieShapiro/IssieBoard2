import { detectWordLanguage } from '../../apps/issievoice/src/utils/languageDetection';

describe('detectWordLanguage', () => {
  test('detects English words', () => {
    expect(detectWordLanguage('hello')).toBe('en');
    expect(detectWordLanguage('Dog')).toBe('en');
    expect(detectWordLanguage("I'm")).toBe('en');
  });

  test('detects Hebrew words', () => {
    expect(detectWordLanguage('שלום')).toBe('he');
    expect(detectWordLanguage('כלב')).toBe('he');
    expect(detectWordLanguage('אני')).toBe('he');
  });

  test('detects Arabic words', () => {
    expect(detectWordLanguage('مرحبا')).toBe('ar');
    expect(detectWordLanguage('كلب')).toBe('ar');
  });

  test('falls back to en for numbers and punctuation', () => {
    expect(detectWordLanguage('123')).toBe('en');
    expect(detectWordLanguage('...')).toBe('en');
    expect(detectWordLanguage('')).toBe('en');
  });

  test('handles mixed script (majority wins)', () => {
    // Hebrew with nikkud still Hebrew
    expect(detectWordLanguage('שָׁלוֹם')).toBe('he');
  });
});
