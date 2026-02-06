import { PredefinedRulesCollection } from '../../types';

// Import predefined rules JSON files
const enRules = require('../../assets/predefined-rules/en.json');
const heRules = require('../../assets/predefined-rules/he.json');
const arRules = require('../../assets/predefined-rules/ar.json');

// Map of language code to predefined rules
const predefinedRulesMap: Record<string, PredefinedRulesCollection> = {
  en: enRules,
  he: heRules,
  ar: arRules,
};

/**
 * Get predefined rules for a specific language
 */
export const getPredefinedRules = (languageCode: string): PredefinedRulesCollection | null => {
  return predefinedRulesMap[languageCode] || null;
};

/**
 * Get all available languages that have predefined rules
 */
export const getAvailableLanguages = (): Array<{ code: string; name: string }> => {
  return Object.keys(predefinedRulesMap).map(code => ({
    code,
    name: predefinedRulesMap[code].languageName,
  }));
};

/**
 * Check if a language has predefined rules
 */
export const hasPredefinedRules = (languageCode: string): boolean => {
  return languageCode in predefinedRulesMap;
};