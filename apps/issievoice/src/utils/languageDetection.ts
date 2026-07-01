/**
 * Per-word language detection utility.
 *
 * Determines the language of a single word by counting Hebrew, Arabic, and
 * Latin characters and returning the script with the highest count.
 * Used by SymbolService to choose the correct ARASAAC API locale.
 *
 * Character-range helpers mirror those in textDirection.ts but are duplicated
 * here because that module does not export them.
 */

const isHebrewChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (code >= 0x0590 && code <= 0x05FF) || // Hebrew block (includes nikkud)
         (code >= 0xFB1D && code <= 0xFB4F);   // Hebrew presentation forms
};

const isArabicChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (code >= 0x0600 && code <= 0x06FF) || // Arabic block
         (code >= 0x0750 && code <= 0x077F) || // Arabic Supplement
         (code >= 0x08A0 && code <= 0x08FF) || // Arabic Extended-A
         (code >= 0xFB50 && code <= 0xFDFF) || // Arabic Presentation Forms-A
         (code >= 0xFE70 && code <= 0xFEFF);   // Arabic Presentation Forms-B
};

const isLatinChar = (char: string): boolean => /[a-zA-Z]/.test(char);

/**
 * Detects the language of a single word based on its script.
 *
 * Iterates through the characters, tallying Hebrew, Arabic, and Latin counts.
 * The script with the highest count wins. Falls back to 'en' when no
 * script characters are found (e.g. numbers, punctuation, empty string).
 *
 * @param word - A single word to analyze
 * @returns 'he' for Hebrew, 'ar' for Arabic, 'en' for Latin / fallback
 */
export const detectWordLanguage = (word: string): 'en' | 'he' | 'ar' => {
  let hebrew = 0;
  let arabic = 0;
  let latin = 0;

  for (const char of word) {
    if (isHebrewChar(char)) hebrew++;
    else if (isArabicChar(char)) arabic++;
    else if (isLatinChar(char)) latin++;
  }

  if (hebrew >= arabic && hebrew >= latin && hebrew > 0) return 'he';
  if (arabic >= hebrew && arabic >= latin && arabic > 0) return 'ar';
  return 'en';
};
