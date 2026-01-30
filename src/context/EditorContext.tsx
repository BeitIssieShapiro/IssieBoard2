import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { KeyboardConfig, StyleGroup, KeyStyleOverride, DiacriticsSettings } from '../../types';

// Key identifier for selection
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
  | { type: 'MARK_SAVED' };

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

    case 'SET_ACTIVE_GROUP':
      return {
        ...state,
        activeGroupId: action.payload,
        // Select all keys in the group
        selectedKeys: action.payload
          ? state.styleGroups.find(g => g.id === action.payload)?.members || []
          : state.selectedKeys,
      };

    case 'CREATE_GROUP': {
      if (state.selectedKeys.length === 0) return state;
      
      const newGroup: StyleGroup = {
        id: generateGroupId(),
        name: action.payload.name,
        members: [...state.selectedKeys],
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
      const newGroups = state.styleGroups.map(g => {
        if (g.id !== action.payload.groupId) return g;
        const newMembers = new Set([...g.members, ...action.payload.keyIds]);
        return { ...g, members: Array.from(newMembers) };
      });
      
      return {
        ...state,
        styleGroups: newGroups,
        isDirty: true,
      };
    }

    case 'REMOVE_FROM_GROUP': {
      const newGroups = state.styleGroups.map(g => {
        if (g.id !== action.payload.groupId) return g;
        return {
          ...g,
          members: g.members.filter(m => !action.payload.keyIds.includes(m)),
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
        members: [...state.selectedKeys],
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

    case 'MARK_SAVED':
      return {
        ...state,
        isDirty: false,
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
const getComputedKeyStyle = (
  keyId: string,
  styleGroups: StyleGroup[]
): KeyStyleOverride => {
  const computedStyle: KeyStyleOverride = {};
  
  // Apply groups in order (later groups override), skip inactive groups
  for (const group of styleGroups) {
    // Only apply active groups (default to true if not specified)
    if (group.active !== false && group.members.includes(keyId)) {
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

  const getComputedKeyStyleFn = useCallback((keyId: string): KeyStyleOverride => {
    return getComputedKeyStyle(keyId, state.styleGroups);
  }, [state.styleGroups]);

  const getKeyGroups = useCallback((keyId: string): StyleGroup[] => {
    return state.styleGroups.filter(g => g.members.includes(keyId));
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

  const value: EditorContextValue = {
    state,
    dispatch,
    selectKey,
    toggleKeySelection,
    selectKeys,
    clearSelection,
    createGroup,
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