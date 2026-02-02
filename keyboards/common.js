/**
 * Common Keyboard Keysets
 * 
 * This file contains shared keysets (123, #+=) that are used across all languages.
 * Language-specific keys can be filtered using the `forLanguages` array.
 * 
 * Key properties:
 * - forLanguages: Array of language codes (e.g., ["he", "ar"]) - key is only included for those languages
 *                 If not specified, key is included for all languages
 * 
 * Note: Bottom rows are NOT included here - each language defines its own bottom row
 * with `alwaysInclude: true` which gets appended to these keysets during build.
 */

module.exports = {
  keysets: [
    {
      id: "123",
      rows: [
        {
          keys: [
            { value: "1" },
            { value: "2" },
            { value: "3" },
            { value: "4" },
            { value: "5" },
            { value: "6" },
            { value: "7" },
            { value: "8" },
            { value: "9" },
            { value: "0" }
          ]
        },
        {
          keys: [
            { value: "-" },
            { value: "/" },
            { value: ":" },
            { value: ";" },
            // RTL languages show reversed parentheses
            { caption: "(", value: ")", forLanguages: ["he", "ar"] },
            { value: "(", forLanguages: ["en"] },
            { caption: ")", value: "(", forLanguages: ["he", "ar"] },
            { value: ")", forLanguages: ["en"] },
            // Currency symbols per language
            { value: "₪", forLanguages: ["he"] },
            { value: "$", forLanguages: ["en", "ar"] },
            { value: "&" },
            { value: "@" },
            { value: "\"" }
          ]
        },
        {
          keys: [
            { type: "keyset", keysetValue: "#+=", returnKeysetValue: "123", label: "#+=", returnKeysetLabel: "123", width: 1.5 },
            { value: "." },
            { value: "," },
            { value: "?", forLanguages: ["he", "en"] },
            { value: "؟", forLanguages: ["ar"] },
            { value: "!" },
            { value: "'" }
            // backspace is added from language file (alwaysInclude key)
          ]
        }
        // NO bottom row - each language defines its own with alwaysInclude: true
      ]
    },
    {
      id: "#+=",
      rows: [
        {
          keys: [
            // RTL languages show reversed brackets
            { caption: "[", value: "]", forLanguages: ["he", "ar"] },
            { value: "[", forLanguages: ["en"] },
            { caption: "]", value: "[", forLanguages: ["he", "ar"] },
            { value: "]", forLanguages: ["en"] },
            { caption: "{", value: "}", forLanguages: ["he", "ar"] },
            { value: "{", forLanguages: ["en"] },
            { caption: "}", value: "{", forLanguages: ["he", "ar"] },
            { value: "}", forLanguages: ["en"] },
            { value: "#" },
            { value: "%" },
            { value: "^" },
            { value: "*" },
            { value: "+" },
            { value: "=" }
          ]
        },
        {
          keys: [
            { value: "_" },
            { value: "\\" },
            { value: "|" },
            { value: "~" },
            { value: "<" },
            { value: ">" },
            { value: "€" },
            { value: "£" },
            { value: "¥" },
            { value: "•" }
          ]
        },
        {
          keys: [
            { type: "keyset", keysetValue: "123", returnKeysetValue: "#+=", label: "123", returnKeysetLabel: "#+=", width: 1.5 },
            { hidden: true, width: 0.25 },
            { value: "." },
            { value: "," },
            { value: "?", forLanguages: ["he", "en"] },
            { value: "؟", forLanguages: ["ar"] },
            { value: "!" },
            { value: "'" }
            // backspace is added from language file (alwaysInclude key)
          ]
        }
        // NO bottom row - each language defines its own with alwaysInclude: true
      ]
    }
  ]
};
