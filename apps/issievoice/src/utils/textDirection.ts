/**
 * Utility functions for detecting text direction based on content
 */

/**
 * Checks if a character is Hebrew
 */
const isHebrewChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (code >= 0x0590 && code <= 0x05FF) || // Hebrew block
         (code >= 0xFB1D && code <= 0xFB4F);   // Hebrew presentation forms
};

/**
 * Checks if a character is Arabic
 */
const isArabicChar = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return (code >= 0x0600 && code <= 0x06FF) || // Arabic block
         (code >= 0x0750 && code <= 0x077F) || // Arabic Supplement
         (code >= 0x08A0 && code <= 0x08FF) || // Arabic Extended-A
         (code >= 0xFB50 && code <= 0xFDFF) || // Arabic Presentation Forms-A
         (code >= 0xFE70 && code <= 0xFEFF);   // Arabic Presentation Forms-B
};

/**
 * Detects if text should be displayed RTL based on its first significant character
 * @param text - The text to analyze
 * @returns 'rtl' if text starts with Hebrew/Arabic, 'ltr' otherwise
 */
export const detectTextDirection = (text: string): 'rtl' | 'ltr' => {
  if (!text || text.length === 0) {
    return 'ltr';
  }

  // Find the first significant (non-whitespace, non-punctuation) character
  for (const char of text) {
    // Skip whitespace and common punctuation
    if (char.trim() === '' || /[.,;:!?()[\]{}"'`]/.test(char)) {
      continue;
    }

    // Check if it's Hebrew or Arabic
    if (isHebrewChar(char) || isArabicChar(char)) {
      return 'rtl';
    }

    // If we hit a Latin character or other LTR script, return ltr
    if (/[a-zA-Z0-9]/.test(char)) {
      return 'ltr';
    }
  }

  // Default to LTR if we couldn't determine
  return 'ltr';
};
