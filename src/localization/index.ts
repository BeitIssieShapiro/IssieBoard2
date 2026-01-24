import { useState, useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';
import { Language, Strings, getStrings } from './strings';

export type { Language, Strings } from './strings';

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

// Hook for using localization
export const useLocalization = () => {
  const [language, setLanguage] = useState<Language>(getDeviceLanguage());
  const [strings, setStrings] = useState<Strings>(getStrings(language));

  useEffect(() => {
    setStrings(getStrings(language));
  }, [language]);

  const changeLanguage = (newLang: Language) => {
    setLanguage(newLang);
  };

  // Check if current language is RTL
  const isRTL = language === 'he' || language === 'ar';

  return {
    language,
    strings,
    changeLanguage,
    isRTL,
  };
};

// Simple getter for use outside of components
export { getStrings };
