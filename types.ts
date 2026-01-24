export interface SavedProfile {
    name: string;
    key: string;
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
    color?: string;
    bgColor?: string;
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
}

// Keyboard definition (as stored in keyboard JSON files)
export interface KeyboardDefinition {
    id: string;
    name: string;
    keysets: KeysetConfig[];
}

// Final built keyboard configuration
export interface KeyboardConfig {
    backgroundColor: string;
    defaultKeyset: string;
    keysets: KeysetConfig[];
    groups: GroupConfig[];
    keyboards: string[];
    defaultKeyboard: string;
}

// Config from storage - could be a built KeyboardConfig or ProfileDefinition that needs building
export type StoredConfig = KeyboardConfig | ProfileDefinition;
