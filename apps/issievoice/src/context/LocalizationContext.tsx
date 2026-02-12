import React, { createContext, useContext, useState, useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';
import { Strings, en, he } from '../localization/strings';

type Language = 'en' | 'he';

interface LocalizationContextType {
  language: Language;
  strings: Strings;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(
  undefined,
);

const getDeviceLanguage = (): Language => {
  let deviceLanguage = 'he';

  if (Platform.OS === 'ios') {
    deviceLanguage =
      NativeModules.SettingsManager?.settings?.AppleLocale ||
      NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
      'en';
  } else {
    deviceLanguage = NativeModules.I18nManager?.localeIdentifier || 'en';
  }

  // Extract language code (e.g., "he_IL" -> "he", "en_US" -> "en")
  const langCode = deviceLanguage.split('_')[0].split('-')[0].toLowerCase();

  // Only support en/he for now
  return langCode === 'he' ? 'he' : 'en';
};

const getStrings = (language: Language): Strings => {
  switch (language) {
    case 'he':
      return he;
    case 'en':
    default:
      return en;
  }
};

export const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguage] = useState<Language>(getDeviceLanguage());
  const [strings, setStrings] = useState<Strings>(getStrings(language));

  useEffect(() => {
    setStrings(getStrings(language));
  }, [language]);

  const isRTL = language === 'he';

  return (
    <LocalizationContext.Provider
      value={{
        language,
        strings,
        setLanguage,
        isRTL,
      }}>
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
