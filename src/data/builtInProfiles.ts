import { StyleGroup } from '../../types';

/**
 * Built-in profile template definition
 * These templates are used to generate read-only profile configurations
 */
export interface BuiltInProfileTemplate {
  id: string;                    // Template ID: 'default', 'classic', 'high-contrast'
  name: string;                  // Display name: "Default", "IssieBoard Classic", "High Contrast"
  description?: string;          // Optional description
  config: {
    backgroundColor?: string;
    keysBgColor?: string;
    textColor?: string;
    fontSizePreset?: 'xs' | 'small' | 'normal' | 'large' | 'xl';  // Font size preset (replaces fontSize)
    heightPreset?: 'compact' | 'normal' | 'tall' | 'x-tall';      // Height preset (replaces keyHeight)
    fontWeight?: 'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';
    keyGap?: number;
    wordSuggestionsEnabled?: boolean;
    autoCorrectEnabled?: boolean;
    settingsButtonEnabled?: boolean;
  };
  styleGroups: Omit<StyleGroup, 'id' | 'createdAt'>[];  // Style groups without runtime IDs
}

/**
 * Built-in profile templates
 * Each template defines a complete theme with colors, fonts, and layout
 */
export const BUILT_IN_PROFILES: BuiltInProfileTemplate[] = [
  // Default profile - clean, neutral appearance
  {
    id: 'default',
    name: 'Default',
    description: 'Clean, neutral keyboard with comfortable spacing',
    config: {
      backgroundColor: 'default',  // Transparent/liquid glass effect on iOS
      fontSizePreset: 'normal',    // Normal font size
      heightPreset: 'normal',      // Normal keyboard height
      fontWeight: 'heavy',
      keyGap: 3,
      wordSuggestionsEnabled: true,
      autoCorrectEnabled: false,
      settingsButtonEnabled: true,
    },
    styleGroups: [],
  },

  // IssieBoard Classic - yellow keys with blue text, gray background
  {
    id: 'classic',
    name: 'IssieBoard Classic',
    description: 'High-visibility yellow keys with blue text for easy reading',
    config: {
      backgroundColor: '#A0A0A0',   // Medium gray keyboard background
      keysBgColor: '#FFEB3B',       // Bright yellow keys
      textColor: '#0000FF',         // Blue text
      fontSizePreset: 'normal',     // Normal font size
      heightPreset: 'normal',       // Normal keyboard height
      fontWeight: 'heavy',
      keyGap: 3,
      wordSuggestionsEnabled: true,
      autoCorrectEnabled: false,
      settingsButtonEnabled: true,
    },
    styleGroups: [
      {
        name: 'Special Keys',
        members: ['backspace', 'enter', 'keyset', 'space', 'settings', 'close', 'next-keyboard', '123', 'ABC'],
        style: {
          bgColor: '#4DD0E1',  // Cyan/light blue for special keys
          color: '#000000',     // Black text on cyan
        },
        active: true,
        isBuiltIn: true,
      },
    ],
  },

  // High Contrast - white keys on black background
  {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Maximum visibility with white keys on black background',
    config: {
      backgroundColor: '#000000',   // Black keyboard background
      keysBgColor: '#FFEB3B',       // Yellow keys for high contrast
      textColor: '#000000',         // Black text
      fontSizePreset: 'large',      // Larger text for accessibility
      heightPreset: 'tall',         // Taller keys for accessibility
      fontWeight: 'black',          // Boldest font weight
      keyGap: 6,                    // Wider gaps for visual separation
      wordSuggestionsEnabled: true,
      autoCorrectEnabled: false,
      settingsButtonEnabled: true,
    },
    styleGroups: [],
  },
];

/**
 * Get a built-in profile template by ID
 */
export const getBuiltInProfileTemplate = (templateId: string): BuiltInProfileTemplate | undefined => {
  return BUILT_IN_PROFILES.find(t => t.id === templateId);
};

/**
 * Get the profile ID for a built-in template and language
 * @param templateId Template ID ('default', 'classic', 'high-contrast')
 * @param language Language code ('he', 'en', 'ar')
 * @returns Full profile ID like 'he-classic'
 */
export const getBuiltInProfileId = (templateId: string, language: string): string => {
  return `${language}-${templateId}`;
};

/**
 * Extract template ID from a built-in profile ID
 * @param profileId Built-in profile ID like 'he-classic'
 * @returns Template ID like 'classic', or undefined if not a built-in
 */
export const extractTemplateId = (profileId: string): string | undefined => {
  const parts = profileId.split('-');
  if (parts.length < 2) return undefined;

  const templateId = parts.slice(1).join('-');
  return BUILT_IN_PROFILES.some(t => t.id === templateId) ? templateId : undefined;
};

/**
 * Check if a profile ID is a built-in profile
 * @param profileId Profile ID to check
 * @returns true if the profile ID matches a built-in pattern
 */
export const isBuiltInProfileId = (profileId: string): boolean => {
  return extractTemplateId(profileId) !== undefined;
};
