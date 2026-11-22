import * as RNLocalize from 'react-native-localize';
import { Language, Strings, getStrings as getRawStrings } from './strings';
import { createLocalization } from './createLocalization';

export type { Language, Strings } from './strings';

// Get device language
const SUPPORTED_LANGUAGES: Language[] = ['he', 'en', 'ar'];

export const getDeviceLanguage = (): Language => {
  const locales = RNLocalize.getLocales();
  const langCode = (locales[0]?.languageTag || 'en').split(/[-_]/)[0].toLowerCase();

  if (langCode === 'iw') return 'he';
  if (SUPPORTED_LANGUAGES.includes(langCode as Language)) return langCode as Language;
  return 'en';
};

export const { LocalizationProvider, useLocalization, getStrings } =
  createLocalization<Strings>(getRawStrings, getDeviceLanguage);
