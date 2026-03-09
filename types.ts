export interface SavedProfile {
    name: string;
    key: string;
}

// Visibility mode for style rules
export type VisibilityMode = 'default' | 'hide' | 'showOnly';

// Style override that can be applied via groups
export interface KeyStyleOverride {
    visibilityMode?: VisibilityMode;  // 'default' = no effect, 'hide' = hide selected, 'showOnly' = show only selected
    hidden?: boolean;  // Backward compatibility - will be converted to visibilityMode: 'hide'
    opacity?: number;  // Key opacity (0.0 = fully transparent, 1.0 = fully opaque). Useful for preview mode to show semi-hidden keys.
    bgColor?: string;
    color?: string;
    label?: string;
    fontSize?: number;
    borderColor?: string;
}

// Style Group - all styling is done through groups
export interface StyleGroup {
    id: string;                      // Unique ID: "group_1706270400000"
    name: string;                    // Display name: "Vowels", "Hidden Keys"
    members: string[];               // Key values: ["א", "ב", "ג"] - portable across keyboard layouts
    style: KeyStyleOverride;         // What to apply
    createdAt: string;               // ISO timestamp
    isBuiltIn?: boolean;             // System groups can't be deleted
    active?: boolean;                // If false, group is saved but not applied to preview (defaults to true)
}

// Predefined Style Rule (from JSON files)
export interface PredefinedStyleRule {
    id: string;                      // Unique ID: "top-row", "vowels"
    name: string;                    // Display name in the language
    description: string;             // Description in the language
    members: string[];               // Key values for this rule
    style: KeyStyleOverride;         // Pre-configured style
}

// Predefined Rules Collection (JSON file structure)
export interface PredefinedRulesCollection {
    language: string;                // Language code: "en", "he", "ar"
    languageName: string;            // Display name: "English", "Hebrew", "Arabic"
    rules: PredefinedStyleRule[];    // Array of predefined rules
}

// Key configuration for individual keyboard keys
export interface KeyConfig {
    value?: string;
    sValue?: string;
    label?: string;
    caption?: string;
    type?: 'shift' | 'backspace' | 'enter' | 'keyset' | 'next-keyboard' | 'settings' | 'close' | string;
    keysetValue?: string;
    width?: number;
    hidden?: boolean;
    opacity?: number;  // Key opacity (0.0 = fully transparent, 1.0 = fully opaque). Useful for preview mode to show semi-hidden keys.
    color?: string;
    bgColor?: string;
    nikkud?: NikkudOption[];  // Explicit nikkud options (backward compatibility)
}

// Nikkud option for explicit key definitions (backward compatibility)
export interface NikkudOption {
    value: string;
    caption?: string;
    sValue?: string;
    sCaption?: string;
}

// Diacritics System Types

// Individual diacritic mark definition
export interface DiacriticItem {
    id: string;              // Unique identifier (e.g., "kamatz", "patach")
    mark: string;            // Unicode combining mark or replacement character
    name: string;            // Display name in the keyboard's language
    onlyFor?: string[];      // If present, only show for these letters
    excludeFor?: string[];   // If present, don't show for these letters
    isReplacement?: boolean; // If true, replaces the letter entirely
    isAdvanced?: boolean;    // If true, this is an advanced diacritic (hidden in simple mode)
}

// Option for a multi-option modifier (like shin/sin)
export interface DiacriticModifierOption {
    id: string;              // Unique identifier (e.g., "shin", "sin")
    mark: string;            // Unicode combining mark
    name: string;            // Display name
}

// Modifier that can combine with other diacritics (like dagesh or shadda)
export interface DiacriticModifier {
    id: string;              // Unique identifier (e.g., "dagesh", "shinSin")
    mark?: string;           // Unicode combining mark (for simple toggle, absent for multi-option)
    name: string;            // Display name
    appliesTo?: string[];    // If present, only applies to these letters
    excludeFor?: string[];   // If present, doesn't apply to these letters
    options?: DiacriticModifierOption[];  // If present, this is a multi-option modifier
}

// Diacritics definition for a keyboard
export interface DiacriticsDefinition {
    appliesTo?: string[];            // Characters that should trigger diacritics popup (if absent, no popup)
    items: DiacriticItem[];
    modifier?: DiacriticModifier;    // Backward compatibility - single modifier
    modifiers?: DiacriticModifier[]; // New - array of modifiers
}

// Per-keyboard diacritics settings in profile
export interface DiacriticsSettings {
    hidden?: string[];            // Array of diacritic item IDs to hide
    disabledModifiers?: string[]; // Array of modifier IDs to disable (default: all enabled)
    modifierEnabled?: boolean;    // Backward compatibility: global toggle for all modifiers
    disabled?: boolean;           // If true, completely disable nikkud for this keyboard (hide nikkud key)
    simpleMode?: boolean;         // If true, hide advanced diacritics (default: true for out-of-box experience)
}

// Row containing keys
export interface RowConfig {
    keys: KeyConfig[];
}

// Keyset containing rows
export interface KeysetConfig {
    id: string;
    rows: RowConfig[];
}

// Group template for styling
export interface GroupTemplate {
    color: string;
    bgColor: string;
    hidden?: boolean;  // Backward compatibility
    visibilityMode?: VisibilityMode;  // New tri-state visibility
    opacity?: number;  // Key opacity (0.0 = fully transparent, 1.0 = fully opaque). Useful for preview mode to show semi-hidden keys.
    fontSize?: number;  // Font size for keys in this group
}

// Group configuration
export interface GroupConfig {
    name: string;
    items: string[];
    template: GroupTemplate;
}

// System row configuration
export interface SystemRowConfig {
    enabled: boolean;
    keys: KeyConfig[];
}

// Profile definition (as stored in profile JSON files)
export interface ProfileDefinition {
    id: string;
    name: string;
    version?: string;
    keyboards: string[];
    defaultKeyboard: string;
    defaultKeyset: string;
    backgroundColor: string;
    systemRow?: SystemRowConfig;
    groups?: GroupConfig[];
    diacritics?: Record<string, DiacriticsSettings>;  // Per-keyboard diacritics settings
    heightPreset?: 'compact' | 'normal' | 'tall' | 'x-tall';  // Keyboard height preset
    keyGap?: number;  // Gap between keys in points (default: 3)
    fontWeight?: 'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';
    fontSize?: number;  // Font size for keys (default: 24). Adjust per font as needed (e.g., 32 for Yad font)
}

// Keyboard definition (as stored in keyboard JSON files)
export interface KeyboardDefinition {
    id: string;
    name: string;
    keysets: KeysetConfig[];
    diacritics?: DiacriticsDefinition;  // Diacritics catalog for this keyboard
}

// Final built keyboard configuration
export interface KeyboardConfig {
    backgroundColor: string;
    defaultKeyset: string;
    keysets: KeysetConfig[];
    groups: GroupConfig[];
    keyboards: string[];
    defaultKeyboard: string;
    diacritics?: DiacriticsDefinition;  // Backward compatibility: merged diacritics from keyboard definition
    allDiacritics?: Record<string, DiacriticsDefinition>;  // Per-keyboard diacritics definitions
    diacriticsSettings?: Record<string, DiacriticsSettings>;  // From profile
    wordSuggestionsEnabled?: boolean;  // Whether word suggestions bar is shown (default: true)
    autoCorrectEnabled?: boolean;  // Whether auto-correct replaces typed word with suggestion on space (default: true)
    fontName?: string;  // Custom font name to use for character keys (e.g., 'DanaYadAlefAlefAlef-Normal'). If not set, system font is used.
    fontSize?: number;  // Global font size for all keys (default: 24). Individual keys can override this. Use different values per font as needed.
    heightPreset?: 'compact' | 'normal' | 'tall' | 'x-tall';  // Keyboard height preset (default: 'normal'). Automatically adapts to device and orientation.
    keyGap?: number;  // Gap between keys in points (default: 3)
    fontWeight?: 'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';  // Font weight (default: 'regular')
    settingsButtonEnabled?: boolean;  // Whether settings button is shown on keyboard (default: true)
}

// Config from storage - could be a built KeyboardConfig or ProfileDefinition that needs building
export type StoredConfig = KeyboardConfig | ProfileDefinition;
