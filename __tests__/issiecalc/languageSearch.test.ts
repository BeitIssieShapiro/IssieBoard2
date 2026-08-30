import { languageMatchesQuery, getLanguageDisplayName } from '../../apps/issiecalc/src/utils/languageNames';

describe('languageMatchesQuery', () => {
  test('empty query matches everything', () => {
    expect(languageMatchesQuery('he-IL', '')).toBe(true);
    expect(languageMatchesQuery('en-US', '   ')).toBe(true);
  });

  test('matches by English language name, partial and case-insensitive', () => {
    expect(languageMatchesQuery('he-IL', 'heb')).toBe(true);
    expect(languageMatchesQuery('he-IL', 'Hebrew')).toBe(true);
    expect(languageMatchesQuery('he-IL', 'HEBREW')).toBe(true);
    expect(languageMatchesQuery('fr-FR', 'fren')).toBe(true);
  });

  test('matches by localized name regardless of UI language', () => {
    expect(languageMatchesQuery('he-IL', 'עברית')).toBe(true);
    expect(languageMatchesQuery('he-IL', 'العبرية')).toBe(true);
    expect(languageMatchesQuery('ar-SA', 'ערבית')).toBe(true);
  });

  test('matches by raw code and full locale', () => {
    expect(languageMatchesQuery('he', 'he')).toBe(true);
    expect(languageMatchesQuery('he-IL', 'he-IL')).toBe(true);
    expect(languageMatchesQuery('he-IL', 'he')).toBe(true);
  });

  test('does not match unrelated languages', () => {
    expect(languageMatchesQuery('he-IL', 'french')).toBe(false);
    expect(languageMatchesQuery('en-US', 'עברית')).toBe(false);
    expect(languageMatchesQuery('de-DE', 'zzz')).toBe(false);
  });

  test('bare prefix without region still resolves a name', () => {
    expect(languageMatchesQuery('ja', 'japanese')).toBe(true);
    expect(languageMatchesQuery('zh', 'chinese')).toBe(true);
  });

  test('unknown language code falls back to matching the code itself', () => {
    expect(languageMatchesQuery('xx-YY', 'xx')).toBe(true);
    expect(languageMatchesQuery('xx-YY', 'hebrew')).toBe(false);
  });
});

describe('getLanguageDisplayName (unchanged by extraction)', () => {
  test('localizes into the UI language', () => {
    expect(getLanguageDisplayName('he', 'en')).toBe('Hebrew');
    expect(getLanguageDisplayName('he', 'he')).toBe('עברית');
    expect(getLanguageDisplayName('he', 'ar')).toBe('العبرية');
  });

  test('appends region when present', () => {
    expect(getLanguageDisplayName('he-IL', 'en')).toBe('Hebrew (IL)');
    expect(getLanguageDisplayName('en-US', 'en')).toBe('English (US)');
  });

  test('falls back to English names for an unknown UI language', () => {
    expect(getLanguageDisplayName('he', 'fr')).toBe('Hebrew');
  });

  test('falls back to the raw prefix for an unknown language', () => {
    expect(getLanguageDisplayName('xx', 'en')).toBe('xx');
  });
});
