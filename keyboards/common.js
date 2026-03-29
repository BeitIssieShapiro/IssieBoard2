/**
 * Common Keyboard Keysets & Structural Templates
 *
 * This file contains:
 * 1. Structural templates (mobile/large) — defines where structural keys
 *    (backspace, enter, shift, space, etc.) are placed in every keyset
 * 2. Shared symbol keysets (123, #+=) — pure symbols, no structural keys
 *
 * Key properties:
 * - forLanguages: Array of language codes — key is only included for those languages
 *                 If not specified, key is included for all languages
 * - ifHasDiacritics: true — key is only included if the language has a diacritics block
 * - showForField: Array of field types — runtime filter, passes through to output JSON
 *
 * The build script merges these templates with language-specific letter rows,
 * producing two variants per keyset: mobile (base ID) and large-screen (_large suffix).
 */

module.exports = {
  structural: {
    mobile: {
      // Injected into existing content rows (default for all keysets)
      lastRow: {
        append: [{ type: "backspace", width: 1.5 }]
      },
      // Per-keyset overrides: when present, REPLACES default row injections entirely
      // (does not affect bottomRow — that's always shared)
      keysetOverrides: {
        "abc": {
          firstRow: { append: [{ type: "backspace", width: 1.5, forLanguages: ["he"] }] },
          lastRow: {
            prepend: [
              { type: "shift", width: 1.5, forLanguages: ["en"] },
              { "hidden": true, "width": 0.5, forLanguages: ["he"] },
            ],
            append: [{ type: "backspace", width: 1.5, forLanguages: ["en", "ar"] }]
          }
        }
      },
      // Appended as a new final row to every keyset
      bottomRow: [
        { type: "keyset", width: 1.5 },
        { type: "next-keyboard", width: 1 },
        { type: "settings" },
        { type: "space", flex: true },
        { caption: "@", value: "@", width: 1, showForField: ["email"], forLanguages: ["en"] },
        { type: "nikkud", ifHasDiacritics: true },
        { type: "enter", width: 2 }
      ]
    },
    large: {
      // Injected into existing content rows (default for all keysets)
      firstRow: {
       // append: [{ type: "backspace", width: 1.5, forLanguages:["he", "en"] }]
      },
      secondRow: {
        append: [{ type: "enter", width: 2 }]
      },
      lastRow: {},
      keysetOverrides: {
        "abc": {
          firstRow: { append: [{ type: "backspace", width: 1.5 }] },
          secondRow: {
            prepend: [
              { "hidden": true, width: 0.5, forLanguages: ["he"] }],
            append: [
              { type: "enter", width: 2, forLanguages: ["en"] },
              
            ]
          },
          lastRow: {
            prepend: [{ type: "shift", width: 1, forLanguages: ["en"] }],
            append: [
              { value: ",", sValue: "!", forLanguages: ["en"] },
              { value: ".", sValue: "?", forLanguages: ["en"] },
              { type: "shift", width: 1.5, forLanguages: ["en"] },
              { "hidden": true, width: 0.5, forLanguages: ["he", "ar"] },
              { type: "enter", width: 2, forLanguages: ["he", "ar"] }

            ]
          }
        },
        "123": {
          lastRow: {
            append: [
              { type: "enter", width: 1.5 }
            ]
          }
        },
        "#+=" : {
          lastRow: {
            append: [
              { type: "enter", width: 1.5 }
            ]
          }
        }
      },
      // Appended as a new final row to every keyset
      bottomRow: [
        { type: "keyset", width: 1 },
        { type: "next-keyboard", width: 1 },
        { type: "settings" },
        { type: "space", flex: true },
        { caption: "@", value: "@", width: 1, showForField: ["email"], forLanguages: ["en"] },
        { type: "keyset", width: 1 },
        { type: "nikkud", ifHasDiacritics: true },
        { type: "close" }
      ]
    }
  },
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
              { caption: "(", value: ")", forLanguages: ["he", "ar"] },
              { value: "(", forLanguages: ["en"] },
              { caption: ")", value: "(", forLanguages: ["he", "ar"] },
              { value: ")", forLanguages: ["en"] },
              { value: "\u20AA", forLanguages: ["he"] },
              { value: "$", forLanguages: ["en", "ar"] },
              { value: "&" },
              { value: "@" },
              { value: "\"" }
            ]
          },
          {
            keys: [
              { type: "keyset", keysetValue: "#+=", returnKeysetValue: "123", label: "#+=", returnKeysetLabel: "123", width: 1.5 },
              { hidden: true, width: 0.25 },
              { value: ".", width: 1.3 },
              { value: ",", width: 1.3 },
              { value: "?", forLanguages: ["he", "en"], width: 1.3 },
              { value: "\u061F", forLanguages: ["ar"], width: 1.3 },
              { value: "!", width: 1.3 },
              { value: "'", width: 1.3 },
              { hidden: true, width: 0.25 },
            ]
          }
        ]
      },
      {
        id: "#+=",
        rows: [
          {
            keys: [
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
              { value: "\u20AC" },
              { value: "\u00A3" },
              { value: "\u00A5" },
              { value: "\u2022" }
            ]
          },
          {
            keys: [
              { type: "keyset", keysetValue: "123", returnKeysetValue: "#+=", label: "123", returnKeysetLabel: "#+=", width: 1.5 },
              { hidden: true, width: 0.25 },
              { value: ".", width: 1.3 },
              { value: ",", width: 1.3 },
              { value: "?", forLanguages: ["he", "en"], width: 1.3 },
              { value: "\u061F", forLanguages: ["ar"], width: 1.3 },
              { value: "!", width: 1.3 },
              { value: "'", width: 1.3 },
              { hidden: true, width: 0.25 }
            ]
          }
        ]
      }
    ]
  };
