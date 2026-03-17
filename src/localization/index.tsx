import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';
import { Language, Strings, getStrings as getRawStrings } from './strings';

export type { Language, Strings } from './strings';

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

export const getStrings = (language: Language): Strings => {
  const strings = getRawStrings(language);
  return DEBUG_LOCALIZATION ? prefixStrings(strings) : strings;
};

// Get device language
const getDeviceLanguage = (): Language => {
  let deviceLang = 'en';

  if (Platform.OS === 'ios') {
    deviceLang = NativeModules.SettingsManager?.settings?.AppleLocale ||
                 NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
                 'en';
  } else {
    deviceLang = NativeModules.I18nManager?.localeIdentifier || 'en';
  }

  // Extract language code (e.g., "en_US" -> "en", "he_IL" -> "he")
  const langCode = deviceLang.split(/[_-]/)[0].toLowerCase();

  // Return supported language or fallback to English
  if (langCode === 'he' || langCode === 'iw') return 'he';
  if (langCode === 'ar') return 'ar';
  return 'en';
};

interface LocalizationContextValue {
  language: Language;
  strings: Strings;
  changeLanguage: (newLang: Language) => void;
  isRTL: boolean;
}

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

export const useLocalization = (): LocalizationContextValue => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};
