import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

export type Language = 'en' | 'he' | 'ar';

const DEBUG_LOCALIZATION = false;

// Debug aid: prefixes every string with '.' so untranslated, hardcoded text stands out.
function prefixStrings<T>(obj: T): T {
  if (typeof obj === 'string') return ('.' + obj) as T;
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, prefixStrings(v)])
    ) as T;
  }
  return obj;
}

export interface LocalizationContextValue<S> {
  language: Language;
  strings: S;
  changeLanguage: (newLang: Language) => void;
  isRTL: boolean;
}

/**
 * Builds a localization provider + hook over one string table. Each app area
 * (the editor, IssieVoice) has its own table but the same behavior.
 */
export function createLocalization<S>(
  getRawStrings: (language: Language) => S,
  getInitialLanguage: () => Language,
) {
  const getStrings = (language: Language): S => {
    const strings = getRawStrings(language);
    return DEBUG_LOCALIZATION ? prefixStrings(strings) : strings;
  };

  const Context = createContext<LocalizationContextValue<S> | undefined>(undefined);

  const LocalizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>(getInitialLanguage);
    const strings = useMemo(() => getStrings(language), [language]);
    const isRTL = language === 'he' || language === 'ar';

    const changeLanguage = useCallback((newLang: Language) => {
      setLanguage(newLang);
    }, []);

    const value = useMemo(
      () => ({ language, strings, changeLanguage, isRTL }),
      [language, strings, changeLanguage, isRTL],
    );

    return <Context.Provider value={value}>{children}</Context.Provider>;
  };

  const useLocalization = (): LocalizationContextValue<S> => {
    const context = useContext(Context);
    if (!context) {
      throw new Error('useLocalization must be used within a LocalizationProvider');
    }
    return context;
  };

  return { LocalizationProvider, useLocalization, getStrings };
}
