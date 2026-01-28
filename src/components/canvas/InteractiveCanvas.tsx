import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { KeyboardPreview, KeyPressEvent } from '../KeyboardPreview';
import { useEditor, KeyIdentifier } from '../../context/EditorContext';

// Helper to cycle to next keyset of the same type across keyboards
const getNextKeysetId = (
  currentKeysetId: string,
  keyboards: string[],
  allKeysets: { id: string }[]
): string => {
  // Determine current keyset type (abc, 123, or #+=)
  let currentKeysetType = 'abc';
  if (currentKeysetId.includes('_123') || currentKeysetId === '123') {
    currentKeysetType = '123';
  } else if (currentKeysetId.includes('_#+=') || currentKeysetId === '#+=') {
    currentKeysetType = '#+=';
  } else if (currentKeysetId.includes('_abc') || currentKeysetId === 'abc') {
    currentKeysetType = 'abc';
  }
  
  // Find all keysets of the same type
  const sameTypeKeysets = allKeysets.filter(ks => 
    ks.id === currentKeysetType || ks.id.endsWith(`_${currentKeysetType}`)
  ).map(ks => ks.id);
  
  if (sameTypeKeysets.length <= 1) {
    return currentKeysetId; // No other keyboard to switch to
  }
  
  // Find current position and cycle to next
  const currentIndex = sameTypeKeysets.indexOf(currentKeysetId);
  if (currentIndex === -1) {
    return sameTypeKeysets[0];
  }
  
  const nextIndex = (currentIndex + 1) % sameTypeKeysets.length;
  return sameTypeKeysets[nextIndex];
};
import { KeyboardConfig } from '../../../types';

interface InteractiveCanvasProps {
  onTestInput?: (text: string) => void;
}

export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({ onTestInput }) => {
  const { state, dispatch, selectKey, toggleKeySelection } = useEditor();

  // Find key by matching criteria
  const findKeyIdentifier = useCallback((
    eventType: string,
    eventValue: string,
    eventLabel: string
  ): KeyIdentifier | null => {
    const activeKeyset = state.config.keysets.find(ks => ks.id === state.activeKeyset);
    
    if (activeKeyset) {
      for (let rowIndex = 0; rowIndex < activeKeyset.rows.length; rowIndex++) {
        const row = activeKeyset.rows[rowIndex];
        for (let keyIndex = 0; keyIndex < row.keys.length; keyIndex++) {
          const key = row.keys[keyIndex];
          
          if (eventType && key.type === eventType) {
            return { keysetId: activeKeyset.id, rowIndex, keyIndex };
          }
          
          if (eventValue && (key.value === eventValue || key.sValue === eventValue)) {
            return { keysetId: activeKeyset.id, rowIndex, keyIndex };
          }
          
          if (eventLabel && key.label === eventLabel) {
            return { keysetId: activeKeyset.id, rowIndex, keyIndex };
          }
        }
      }
    }
    
    // Fallback: search all keysets
    for (const keyset of state.config.keysets) {
      if (keyset.id === state.activeKeyset) continue;
      
      for (let rowIndex = 0; rowIndex < keyset.rows.length; rowIndex++) {
        const row = keyset.rows[rowIndex];
        for (let keyIndex = 0; keyIndex < row.keys.length; keyIndex++) {
          const key = row.keys[keyIndex];
          
          if (eventType && key.type === eventType) {
            return { keysetId: keyset.id, rowIndex, keyIndex };
          }
          
          if (eventValue && (key.value === eventValue || key.sValue === eventValue)) {
            return { keysetId: keyset.id, rowIndex, keyIndex };
          }
        }
      }
    }
    
    return null;
  }, [state.config.keysets, state.activeKeyset]);

  const handleKeyPress = useCallback((event: KeyPressEvent) => {
    const { type, value, label } = event.nativeEvent;
    
    console.log(`[InteractiveCanvas] handleKeyPress: type='${type}', value='${value}', label='${label}'`);
    
    // Handle language/keyboard switch - update React state to match native
    // "keyset-changed" is sent by Android with the actual new keyset ID
    if (type === 'keyset-changed' && value) {
      console.log(`[InteractiveCanvas] Native switched keyset to: ${value}`);
      if (value !== state.activeKeyset) {
        dispatch({ type: 'SET_ACTIVE_KEYSET', payload: value });
      }
      return;
    }
    
    // Legacy: "next-keyboard" without value means React should calculate next
    // (used by iOS and non-preview Android)
    if (type === 'next-keyboard' || type === 'language') {
      const nextKeyset = getNextKeysetId(
        state.activeKeyset,
        state.config.keyboards || [],
        state.config.keysets
      );
      if (nextKeyset !== state.activeKeyset) {
        console.log(`[InteractiveCanvas] Switching keyset from ${state.activeKeyset} to ${nextKeyset}`);
        dispatch({ type: 'SET_ACTIVE_KEYSET', payload: nextKeyset });
      }
      return;
    }
    
    if (state.mode === 'test') {
      if (onTestInput && value) {
        onTestInput(value);
      }
      return;
    }
    
    // In edit mode, select/toggle the key
    const keyId = findKeyIdentifier(type, value, label);
    if (keyId) {
      // If there's already a selection, toggle (add/remove from multi-select)
      // Otherwise, single-select
      if (state.selectedKeys.length > 0) {
        toggleKeySelection(keyId);
      } else {
        selectKey(keyId);
      }
    }
  }, [state.mode, state.activeKeyset, state.config.keyboards, state.config.keysets, state.selectedKeys.length, dispatch, findKeyIdentifier, selectKey, toggleKeySelection, onTestInput]);

  // Convert StyleGroups to the GroupConfig format the native renderer expects
  // The native renderer will apply groups at render time
  const configWithGroups = useMemo((): KeyboardConfig => {
    // Convert styleGroups to the groups format expected by native renderer
    const groupConfigs = state.styleGroups.map(group => ({
      name: group.name,
      items: group.members.map(memberId => {
        // Extract the key value from the keyId (keysetId:rowIndex:keyIndex)
        const [keysetId, rowIndexStr, keyIndexStr] = memberId.split(':');
        const rowIndex = parseInt(rowIndexStr, 10);
        const keyIndex = parseInt(keyIndexStr, 10);
        
        const keyset = state.config.keysets.find(ks => ks.id === keysetId);
        if (!keyset) return null;
        const row = keyset.rows[rowIndex];
        if (!row) return null;
        const key = row.keys[keyIndex];
        if (!key) return null;
        
        return key.value || key.caption || key.label || key.type || null;
      }).filter((v): v is string => v !== null),
      template: {
        color: group.style.color || '',
        bgColor: group.style.bgColor || '',
        hidden: group.style.hidden,
      },
    }));

    // Return the base config with the current groups
    return {
      ...state.config,
      groups: groupConfigs,
    };
  }, [state.config, state.styleGroups]);

  const configJson = useMemo(() => {
    const json = JSON.stringify(configWithGroups);
    // Debug: Log diacriticsSettings
    console.log('[InteractiveCanvas] diacriticsSettings:', JSON.stringify(configWithGroups.diacriticsSettings));
    console.log('[InteractiveCanvas] keyboards:', configWithGroups.keyboards);
    return json;
  }, [configWithGroups]);
  
  // Build selected keys JSON for native preview highlighting
  // selectedKeys are already in string format "keysetId:rowIndex:keyIndex"
  const selectedKeysJson = useMemo(() => {
    if (state.selectedKeys.length === 0) return undefined;
    return JSON.stringify(state.selectedKeys);
  }, [state.selectedKeys]);

  return (
    <View style={styles.container}>
      <KeyboardPreview
        style={styles.preview}
        configJson={configJson}
        selectedKeys={selectedKeysJson}
        onKeyPress={handleKeyPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F5F5',
  },
  preview: {
    height: 280,
  },
});

export default InteractiveCanvas;