import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import * as RNLocalize from 'react-native-localize';
import { Language, Strings, getStrings as getRawStrings } from '../localization/strings';

export type { Language, Strings } from '../localization/strings';

const DEBUG_LOCALIZATION = false;

function prefixStrings<T>(obj: T): T {
  if (typeof obj === 'string') return ('.' + obj) as T;
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, prefixStrings(v)])
    ) as T;
  }
  return obj;
}

const getStrings = (language: Language): Strings => {
  const strings = getRawStrings(language);
  return DEBUG_LOCALIZATION ? prefixStrings(strings) : strings;
};

interface LocalizationContextType {
  language: Language;
  strings: Strings;
  changeLanguage: (lang: Language) => void;
  isRTL: boolean;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(
  undefined,
);

const supportedLanguages = ['he', 'en', 'ar'];

const getDeviceLanguage = (): Language => {
  // return 'en'
  const locales = RNLocalize.getLocales();
  const langCode = (locales[0]?.languageTag || 'en').split(/[-_]/)[0].toLowerCase();

  if (langCode === 'iw') return 'he';
  if (supportedLanguages.includes(langCode)) return langCode as Language;
  return 'en';
};

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguage] = useState<Language>(getDeviceLanguage());
  const strings = useMemo(() => getStrings(language), [language]);
  const isRTL = language === 'he' || language === 'ar';

  const changeLanguage = useCallback((newLang: Language) => {
    setLanguage(newLang);
  }, []);

  const value = useMemo(
    () => ({ language, strings, changeLanguage, isRTL }),
    [language, strings, changeLanguage, isRTL],
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = () => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error(
      'useLocalization must be used within LocalizationProvider',
    );
  }
  return context;
};
