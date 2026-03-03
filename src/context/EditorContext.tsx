import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { KeyboardConfig, StyleGroup, KeyStyleOverride, DiacriticsSettings } from '../../types';

// Key identifier for selection (position-based, used for UI highlighting)
export interface KeyIdentifier {
  keysetId: string;
  rowIndex: number;
  keyIndex: number;
}

export const keyIdToString = (id: KeyIdentifier): string =>
  `${id.keysetId}:${id.rowIndex}:${id.keyIndex}`;

export const stringToKeyId = (str: string): KeyIdentifier => {
  const [keysetId, rowIndex, keyIndex] = str.split(':');
  return { keysetId, rowIndex: parseInt(rowIndex, 10), keyIndex: parseInt(keyIndex, 10) };
};

// Helper to get key value from position ID
export const getKeyValueFromPositionId = (
  positionId: string,
  keysets: { id: string; rows: { keys: { value?: string; caption?: string; label?: string; type?: string }[] }[] }[]
): string | null => {
  const [keysetId, rowIndexStr, keyIndexStr] = positionId.split(':');
  const rowIndex = parseInt(rowIndexStr, 10);
  const keyIndex = parseInt(keyIndexStr, 10);
  
  const keyset = keysets.find(ks => ks.id === keysetId);
  if (!keyset) return null;
  const row = keyset.rows[rowIndex];
  if (!row) return null;
  const key = row.keys[keyIndex];
  if (!key) return null;
  
  return key.value || key.caption || key.label || key.type || null;
};

// Helper to check if a key matches a value (for group membership)
export const keyMatchesValue = (
  key: { value?: string; caption?: string; label?: string; type?: string },
  targetValue: string
): boolean => {
  const keyValue = key.value || key.caption || key.label || key.type;
  return keyValue === targetValue;
};

// Editor state
export interface EditorState {
  // Profile data
  config: KeyboardConfig;
  styleGroups: StyleGroup[];
  isDirty: boolean;

  // UI state
  mode: 'edit' | 'test';
  selectedKeys: string[]; // Array of key identifier strings
  activeKeyset: string;
  activeGroupId: string | null; // Currently editing group
}

// Action types
type EditorAction =
  | { type: 'SET_CONFIG'; payload: { config: KeyboardConfig; styleGroups?: StyleGroup[] } }
  | { type: 'SET_MODE'; payload: 'edit' | 'test' }
  | { type: 'SELECT_KEY'; payload: KeyIdentifier }
  | { type: 'DESELECT_KEY'; payload: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_KEY_SELECTION'; payload: KeyIdentifier }
  | { type: 'SELECT_KEYS'; payload: string[] }
  | { type: 'SET_ACTIVE_KEYSET'; payload: string }
  | { type: 'SET_ACTIVE_GROUP'; payload: string | null }
  | { type: 'CREATE_GROUP'; payload: { name: string; style: KeyStyleOverride } }
  | { type: 'CREATE_GROUP_FROM_VALUES'; payload: { name: string; members: string[]; style: KeyStyleOverride; active?: boolean } }
  | { type: 'UPDATE_GROUP'; payload: { groupId: string; updates: Partial<StyleGroup> } }
  | { type: 'DELETE_GROUP'; payload: string }
  | { type: 'ADD_TO_GROUP'; payload: { groupId: string; keyIds: string[] } }
  | { type: 'REMOVE_FROM_GROUP'; payload: { groupId: string; keyIds: string[] } }
  | { type: 'UPDATE_GROUP_STYLE'; payload: { groupId: string; style: Partial<KeyStyleOverride> } }
  | { type: 'TOGGLE_GROUP_ACTIVE'; payload: string }
  | { type: 'APPLY_STYLE_TO_SELECTION'; payload: KeyStyleOverride }
  | { type: 'UPDATE_BACKGROUND_COLOR'; payload: string }
  | { type: 'UPDATE_DIACRITICS_SETTINGS'; payload: { keyboardId: string; settings: DiacriticsSettings } }
  | { type: 'UPDATE_WORD_SUGGESTIONS'; payload: boolean }
  | { type: 'UPDATE_AUTO_CORRECT'; payload: boolean }
  | { type: 'UPDATE_FONT_NAME'; payload: string | undefined }
  | { type: 'UPDATE_FONT_SIZE'; payload: number | undefined }
  | { type: 'UPDATE_KEY_GAP'; payload: number | undefined }
  | { type: 'UPDATE_SETTINGS_BUTTON'; payload: boolean }
  | { type: 'MARK_SAVED' }
  | { type: 'MARK_DIRTY' };

// Generate unique group ID
const generateGroupId = (): string => `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Reducer
function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_CONFIG':
      return {
        ...state,
        config: action.payload.config,
        styleGroups: action.payload.styleGroups || [],
        activeKeyset: action.payload.config.defaultKeyset || action.payload.config.keysets[0]?.id || '',
        isDirty: false,
        selectedKeys: [],
        activeGroupId: null,
      };

    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload,
        selectedKeys: action.payload === 'test' ? [] : state.selectedKeys,
      };

    case 'SELECT_KEY': {
      const keyIdStr = keyIdToString(action.payload);
      if (state.selectedKeys.includes(keyIdStr)) return state;
      return {
        ...state,
        selectedKeys: [keyIdStr], // Single selection replaces
        activeGroupId: null, // Clear active group when selecting a key directly
      };
    }

    case 'TOGGLE_KEY_SELECTION': {
      const keyIdStr = keyIdToString(action.payload);
      const isSelected = state.selectedKeys.includes(keyIdStr);
      return {
        ...state,
        selectedKeys: isSelected
          ? state.selectedKeys.filter(k => k !== keyIdStr)
          : [...state.selectedKeys, keyIdStr],
      };
    }

    case 'SELECT_KEYS':
      return {
        ...state,
        selectedKeys: action.payload,
      };

    case 'DESELECT_KEY':
      return {
        ...state,
        selectedKeys: state.selectedKeys.filter(k => k !== action.payload),
      };

    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedKeys: [],
        activeGroupId: null, // Clear active group when clearing selection
      };

    case 'SET_ACTIVE_KEYSET':
      return {
        ...state,
        activeKeyset: action.payload,
        selectedKeys: [], // Clear selection when switching keysets
      };

    case 'SET_ACTIVE_GROUP': {
      if (!action.payload) {
        return {
          ...state,
          activeGroupId: null,
        };
      }
      
      const group = state.styleGroups.find(g => g.id === action.payload);
      if (!group) {
        return {
          ...state,
          activeGroupId: null,
        };
      }
      
      // Convert key values back to position IDs for selection highlighting
      // Find all keys in the current keyset that match the group's key values
      const selectedPositionIds: string[] = [];
      for (const keyset of state.config.keysets) {
        for (let rowIndex = 0; rowIndex < keyset.rows.length; rowIndex++) {
          const row = keyset.rows[rowIndex];
          for (let keyIndex = 0; keyIndex < row.keys.length; keyIndex++) {
            const key = row.keys[keyIndex];
            const keyValue = key.value || key.caption || key.label || key.type;
            if (keyValue && group.members.includes(keyValue)) {
              selectedPositionIds.push(`${keyset.id}:${rowIndex}:${keyIndex}`);
            }
          }
        }
      }
      
      return {
        ...state,
        activeGroupId: action.payload,
        selectedKeys: selectedPositionIds,
      };
    }

    case 'CREATE_GROUP': {
      if (state.selectedKeys.length === 0) return state;
      
      // Convert position IDs to key values for storage
      // This makes groups portable across keyboard layouts
      const keyValues = state.selectedKeys
        .map(posId => getKeyValueFromPositionId(posId, state.config.keysets))
        .filter((v): v is string => v !== null);
      
      // Remove duplicates (same key value might be selected multiple times)
      const uniqueKeyValues = [...new Set(keyValues)];
      
      if (uniqueKeyValues.length === 0) return state;
      
      const newGroup: StyleGroup = {
        id: generateGroupId(),
        name: action.payload.name,
        members: uniqueKeyValues, // Store key values, not position IDs
        style: action.payload.style,
        createdAt: new Date().toISOString(),
        active: true,
      };
      
      return {
        ...state,
        styleGroups: [...state.styleGroups, newGroup],
        activeGroupId: newGroup.id,
        isDirty: true,
      };
    }

    case 'CREATE_GROUP_FROM_VALUES': {
      // Create a group directly from key values (no selection required)
      if (action.payload.members.length === 0) return state;
      
      const newGroup: StyleGroup = {
        id: generateGroupId(),
        name: action.payload.name,
        members: action.payload.members,
        style: action.payload.style,
        createdAt: new Date().toISOString(),
        active: action.payload.active !== false,
      };
      
      return {
        ...state,
        styleGroups: [...state.styleGroups, newGroup],
        activeGroupId: newGroup.id,
        isDirty: true,
      };
    }

    case 'UPDATE_GROUP': {
      const newGroups = state.styleGroups.map(g =>
        g.id === action.payload.groupId
          ? { ...g, ...action.payload.updates }
          : g
      );
      
      return {
        ...state,
        styleGroups: newGroups,
        isDirty: true,
      };
    }

    case 'DELETE_GROUP': {
      const newGroups = state.styleGroups.filter(g => g.id !== action.payload);
      
      return {
        ...state,
        styleGroups: newGroups,
        activeGroupId: state.activeGroupId === action.payload ? null : state.activeGroupId,
        isDirty: true,
      };
    }

    case 'ADD_TO_GROUP': {
      // Convert position IDs to key values
      const keyValues = action.payload.keyIds
        .map(posId => getKeyValueFromPositionId(posId, state.config.keysets))
        .filter((v): v is string => v !== null);
      
      const newGroups = state.styleGroups.map(g => {
        if (g.id !== action.payload.groupId) return g;
        const newMembers = new Set([...g.members, ...keyValues]);
        return { ...g, members: Array.from(newMembers) };
      });
      
      return {
        ...state,
        styleGroups: newGroups,
        isDirty: true,
      };
    }

    case 'REMOVE_FROM_GROUP': {
      // Convert position IDs to key values
      const keyValuesToRemove = action.payload.keyIds
        .map(posId => getKeyValueFromPositionId(posId, state.config.keysets))
        .filter((v): v is string => v !== null);
      
      const newGroups = state.styleGroups.map(g => {
        if (g.id !== action.payload.groupId) return g;
        return {
          ...g,
          members: g.members.filter(m => !keyValuesToRemove.includes(m)),
        };
      });
      
      return {
        ...state,
        styleGroups: newGroups,
        isDirty: true,
      };
    }

    case 'UPDATE_GROUP_STYLE': {
      const newGroups = state.styleGroups.map(g =>
        g.id === action.payload.groupId
          ? { ...g, style: { ...g.style, ...action.payload.style } }
          : g
      );
      
      return {
        ...state,
        styleGroups: newGroups,
        isDirty: true,
      };
    }

    case 'TOGGLE_GROUP_ACTIVE': {
      const newGroups = state.styleGroups.map(g =>
        g.id === action.payload
          ? { ...g, active: g.active === false ? true : false }
          : g
      );
      
      return {
        ...state,
        styleGroups: newGroups,
        isDirty: true,
      };
    }

    case 'APPLY_STYLE_TO_SELECTION': {
      if (state.selectedKeys.length === 0) return state;
      
      // Convert position IDs to key values for storage
      const keyValues = state.selectedKeys
        .map(posId => getKeyValueFromPositionId(posId, state.config.keysets))
        .filter((v): v is string => v !== null);
      
      // Remove duplicates
      const uniqueKeyValues = [...new Set(keyValues)];
      
      if (uniqueKeyValues.length === 0) return state;
      
      // Generate a unique group name
      const generateNewGroupName = (): string => {
        let counter = 1;
        const existingNames = new Set(state.styleGroups.map(g => g.name));
        while (existingNames.has(`new-group${counter}`)) {
          counter++;
        }
        return `new-group${counter}`;
      };
      
      // Create a new group for this style
      const newGroup: StyleGroup = {
        id: generateGroupId(),
        name: generateNewGroupName(),
        members: uniqueKeyValues, // Store key values, not position IDs
        style: action.payload,
        createdAt: new Date().toISOString(),
        active: true,
      };
      
      return {
        ...state,
        styleGroups: [...state.styleGroups, newGroup],
        activeGroupId: newGroup.id,
        isDirty: true,
      };
    }

    case 'UPDATE_BACKGROUND_COLOR': {
      return {
        ...state,
        config: { ...state.config, backgroundColor: action.payload },
        isDirty: true,
      };
    }

    case 'UPDATE_DIACRITICS_SETTINGS': {
      const { keyboardId, settings } = action.payload;
      const newDiacriticsSettings = {
        ...(state.config.diacriticsSettings || {}),
        [keyboardId]: settings,
      };
      return {
        ...state,
        config: { ...state.config, diacriticsSettings: newDiacriticsSettings },
        isDirty: true,
      };
    }

    case 'UPDATE_WORD_SUGGESTIONS': {
      return {
        ...state,
        config: { ...state.config, wordSuggestionsEnabled: action.payload },
        isDirty: true,
      };
    }

    case 'UPDATE_AUTO_CORRECT': {
      return {
        ...state,
        config: { ...state.config, autoCorrectEnabled: action.payload },
        isDirty: true,
      };
    }

    case 'UPDATE_FONT_NAME': {
      return {
        ...state,
        config: { ...state.config, fontName: action.payload },
        isDirty: true,
      };
    }

    case 'UPDATE_FONT_SIZE': {
      return {
        ...state,
        config: { ...state.config, fontSize: action.payload },
        isDirty: true,
      };
    }

    case 'UPDATE_KEY_GAP': {
      return {
        ...state,
        config: { ...state.config, keyGap: action.payload },
        isDirty: true,
      };
    }

    case 'UPDATE_SETTINGS_BUTTON': {
      return {
        ...state,
        config: { ...state.config, settingsButtonEnabled: action.payload },
        isDirty: true,
      };
    }

    case 'MARK_SAVED':
      return {
        ...state,
        isDirty: false,
      };

    case 'MARK_DIRTY':
      return {
        ...state,
        isDirty: true,
      };

    default:
      return state;
  }
}

// Initial state factory
const createInitialState = (
  config?: KeyboardConfig,
  styleGroups?: StyleGroup[]
): EditorState => ({
  config: config || {
    backgroundColor: '#E0E0E0',
    defaultKeyset: 'abc',
    keysets: [],
    groups: [],
    keyboards: [],
    defaultKeyboard: 'en',
  },
  styleGroups: styleGroups || [],
  isDirty: false,
  mode: 'edit',
  selectedKeys: [],
  activeKeyset: config?.defaultKeyset || 'abc',
  activeGroupId: null,
});

// Helper to get computed key style (base + all applicable active groups)
// keyValue: the actual key character/value (e.g., "א", "backspace")
const getComputedKeyStyle = (
  keyValue: string,
  styleGroups: StyleGroup[]
): KeyStyleOverride => {
  const computedStyle: KeyStyleOverride = {};
  
  // Apply groups in order (later groups override), skip inactive groups
  // group.members now contains key values, not position IDs
  for (const group of styleGroups) {
    // Only apply active groups (default to true if not specified)
    if (group.active !== false && group.members.includes(keyValue)) {
      Object.assign(computedStyle, group.style);
    }
  }
  
  return computedStyle;
};

// Context
interface EditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  
  // Key selection
  selectKey: (keyId: KeyIdentifier) => void;
  toggleKeySelection: (keyId: KeyIdentifier) => void;
  selectKeys: (keyIds: string[]) => void;
  clearSelection: () => void;
  
  // Group operations
  createGroup: (name: string, style: KeyStyleOverride) => void;
  createGroupFromValues: (name: string, members: string[], style: KeyStyleOverride, active?: boolean) => void;
  updateGroup: (groupId: string, updates: Partial<StyleGroup>) => void;
  deleteGroup: (groupId: string) => void;
  addToGroup: (groupId: string, keyIds?: string[]) => void;
  removeFromGroup: (groupId: string, keyIds?: string[]) => void;
  updateGroupStyle: (groupId: string, style: Partial<KeyStyleOverride>) => void;
  toggleGroupActive: (groupId: string) => void;
  setActiveGroup: (groupId: string | null) => void;
  
  // Apply style to current selection
  applyStyleToSelection: (style: KeyStyleOverride) => void;
  
  // Computed values
  getComputedKeyStyle: (keyId: string) => KeyStyleOverride;
  getKeyGroups: (keyId: string) => StyleGroup[];
  getGroupById: (groupId: string) => StyleGroup | undefined;
  
  // Mode and config
  setMode: (mode: 'edit' | 'test') => void;
  setConfig: (config: KeyboardConfig, styleGroups?: StyleGroup[]) => void;
  updateBackgroundColor: (color: string) => void;
  updateWordSuggestions: (enabled: boolean) => void;
  updateAutoCorrect: (enabled: boolean) => void;
  updateFontName: (fontName: string | undefined) => void;
  updateFontSize: (fontSize: number | undefined) => void;
  updateKeyGap: (keyGap: number | undefined) => void;
  updateSettingsButton: (enabled: boolean) => void;
  markDirty: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

// Provider
interface EditorProviderProps {
  children: ReactNode;
  initialConfig?: KeyboardConfig;
  initialStyleGroups?: StyleGroup[];
}

export const EditorProvider: React.FC<EditorProviderProps> = ({ 
  children, 
  initialConfig,
  initialStyleGroups = [],
}) => {
  // Create initial state with both config and styleGroups
  const [state, dispatch] = useReducer(
    editorReducer,
    { config: initialConfig, styleGroups: initialStyleGroups },
    (init) => createInitialState(init.config, init.styleGroups)
  );

  const selectKey = useCallback((keyId: KeyIdentifier) => {
    dispatch({ type: 'SELECT_KEY', payload: keyId });
  }, []);

  const toggleKeySelection = useCallback((keyId: KeyIdentifier) => {
    dispatch({ type: 'TOGGLE_KEY_SELECTION', payload: keyId });
  }, []);

  const selectKeys = useCallback((keyIds: string[]) => {
    dispatch({ type: 'SELECT_KEYS', payload: keyIds });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' });
  }, []);

  const createGroup = useCallback((name: string, style: KeyStyleOverride) => {
    dispatch({ type: 'CREATE_GROUP', payload: { name, style } });
  }, []);

  const createGroupFromValues = useCallback((name: string, members: string[], style: KeyStyleOverride, active: boolean = true) => {
    dispatch({ type: 'CREATE_GROUP_FROM_VALUES', payload: { name, members, style, active } });
  }, []);

  const updateGroup = useCallback((groupId: string, updates: Partial<StyleGroup>) => {
    dispatch({ type: 'UPDATE_GROUP', payload: { groupId, updates } });
  }, []);

  const deleteGroup = useCallback((groupId: string) => {
    dispatch({ type: 'DELETE_GROUP', payload: groupId });
  }, []);

  const addToGroup = useCallback((groupId: string, keyIds?: string[]) => {
    dispatch({ type: 'ADD_TO_GROUP', payload: { groupId, keyIds: keyIds || state.selectedKeys } });
  }, [state.selectedKeys]);

  const removeFromGroup = useCallback((groupId: string, keyIds?: string[]) => {
    dispatch({ type: 'REMOVE_FROM_GROUP', payload: { groupId, keyIds: keyIds || state.selectedKeys } });
  }, [state.selectedKeys]);

  const updateGroupStyle = useCallback((groupId: string, style: Partial<KeyStyleOverride>) => {
    dispatch({ type: 'UPDATE_GROUP_STYLE', payload: { groupId, style } });
  }, []);

  const toggleGroupActive = useCallback((groupId: string) => {
    dispatch({ type: 'TOGGLE_GROUP_ACTIVE', payload: groupId });
  }, []);

  const setActiveGroup = useCallback((groupId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_GROUP', payload: groupId });
  }, []);

  const applyStyleToSelection = useCallback((style: KeyStyleOverride) => {
    dispatch({ type: 'APPLY_STYLE_TO_SELECTION', payload: style });
  }, []);

  // getComputedKeyStyle now expects a key VALUE (e.g., "א"), not a position ID
  const getComputedKeyStyleFn = useCallback((keyValue: string): KeyStyleOverride => {
    return getComputedKeyStyle(keyValue, state.styleGroups);
  }, [state.styleGroups]);

  // getKeyGroups now expects a key VALUE (e.g., "א"), not a position ID
  const getKeyGroups = useCallback((keyValue: string): StyleGroup[] => {
    return state.styleGroups.filter(g => g.members.includes(keyValue));
  }, [state.styleGroups]);

  const getGroupById = useCallback((groupId: string): StyleGroup | undefined => {
    return state.styleGroups.find(g => g.id === groupId);
  }, [state.styleGroups]);

  const setMode = useCallback((mode: 'edit' | 'test') => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  const setConfig = useCallback((config: KeyboardConfig, styleGroups?: StyleGroup[]) => {
    dispatch({ type: 'SET_CONFIG', payload: { config, styleGroups } });
  }, []);

  const updateBackgroundColor = useCallback((color: string) => {
    dispatch({ type: 'UPDATE_BACKGROUND_COLOR', payload: color });
  }, []);

  const updateWordSuggestions = useCallback((enabled: boolean) => {
    dispatch({ type: 'UPDATE_WORD_SUGGESTIONS', payload: enabled });
  }, []);

  const updateAutoCorrect = useCallback((enabled: boolean) => {
    dispatch({ type: 'UPDATE_AUTO_CORRECT', payload: enabled });
  }, []);

  const updateFontName = useCallback((fontName: string | undefined) => {
    dispatch({ type: 'UPDATE_FONT_NAME', payload: fontName });
  }, []);

  const updateFontSize = useCallback((fontSize: number | undefined) => {
    dispatch({ type: 'UPDATE_FONT_SIZE', payload: fontSize });
  }, []);

  const updateKeyGap = useCallback((keyGap: number | undefined) => {
    dispatch({ type: 'UPDATE_KEY_GAP', payload: keyGap });
  }, []);

  const updateSettingsButton = useCallback((enabled: boolean) => {
    dispatch({ type: 'UPDATE_SETTINGS_BUTTON', payload: enabled });
  }, []);

  const markDirty = useCallback(() => {
    dispatch({ type: 'MARK_DIRTY' });
  }, []);

  const value: EditorContextValue = {
    state,
    dispatch,
    selectKey,
    toggleKeySelection,
    selectKeys,
    clearSelection,
    createGroup,
    createGroupFromValues,
    updateGroup,
    deleteGroup,
    addToGroup,
    removeFromGroup,
    updateGroupStyle,
    toggleGroupActive,
    setActiveGroup,
    applyStyleToSelection,
    getComputedKeyStyle: getComputedKeyStyleFn,
    getKeyGroups,
    getGroupById,
    setMode,
    setConfig,
    updateBackgroundColor,
    updateWordSuggestions,
    updateAutoCorrect,
    updateFontName,
    updateFontSize,
    updateKeyGap,
    updateSettingsButton,
    markDirty,
  };

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};

// Hook
export const useEditor = (): EditorContextValue => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
};

export default EditorContext;