import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KeyboardPreview, KeyPressEvent } from '../KeyboardPreview';
import { useEditor } from '../../context/EditorContext';

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
import { filterSettingsButton } from '../../utils/keyboardConfigMerger';

interface InteractiveCanvasProps {
  onTestInput?: (text: string) => void;
}

// Language display names
const LANGUAGE_NAMES: Record<string, string> = {
  'he': 'עברית',
  'en': 'English',
  'ar': 'العربية',
};

export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({ onTestInput }) => {
  const { state, dispatch } = useEditor();
  
  // Get language display name from keyboard ID
  const languageDisplayName = useMemo(() => {
    const keyboardId = state.config.keyboards?.[0] || 'en';
    // Handle variants like 'he_ordered' -> 'he', 'en' -> 'en'
    const baseLanguage = keyboardId.split('_')[0];
    return LANGUAGE_NAMES[baseLanguage] || LANGUAGE_NAMES['en'] || 'English';
  }, [state.config.keyboards]);

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

    // Always in test mode - handle key input
    if (type === 'backspace') {
      if (onTestInput) {
        onTestInput('backspace');
      }
      return;
    }

    // Handle suggestion selection - the value contains the replacement text
    if (type === 'suggestion' && value) {
      if (onTestInput) {
        onTestInput(value);
      }
      return;
    }

    // Regular keys - pass value to test input
    if (onTestInput && value) {
      onTestInput(value);
    }
  }, [state.activeKeyset, state.config.keyboards, state.config.keysets, dispatch, onTestInput]);

  // Convert StyleGroups to the GroupConfig format the native renderer expects
  // StyleGroup.members now stores key values directly (e.g., ["א", "ב"]) not position IDs
  // Only include ACTIVE groups in the preview
  const configWithGroups = useMemo((): KeyboardConfig => {
    // Convert styleGroups to the groups format expected by native renderer
    // Since members are already key values, we can use them directly
    // Only include active groups
    const groupConfigs = state.styleGroups
      .filter(group => group.active !== false)
      .map(group => ({
        name: group.name,
        items: group.members, // Already key values, no conversion needed
        template: {
          color: group.style.color || '',
          bgColor: group.style.bgColor || '',
          // Support both legacy hidden boolean and new visibilityMode
          hidden: group.style.hidden || group.style.visibilityMode === 'hide',
          visibilityMode: group.style.visibilityMode,
        },
      }));

    // Get settingsButtonEnabled setting (default to true)
    const settingsButtonEnabled = state.config.settingsButtonEnabled !== false;

    // Filter out settings button if disabled
    const filteredKeysets = state.config.keysets.map(keyset => ({
      ...keyset,
      rows: keyset.rows.map(row => ({
        ...row,
        keys: filterSettingsButton(row.keys, settingsButtonEnabled),
      })),
    }));

    // Return the base config with the current groups and filtered keysets
    // Disable word suggestions for preview
    return {
      ...state.config,
      keysets: filteredKeysets,
      groups: groupConfigs,
      wordSuggestionsEnabled: false,
    };
  }, [state.config, state.styleGroups]);

  const configJson = useMemo(() => {
    return JSON.stringify(configWithGroups);
  }, [configWithGroups]);

  // Calculate dynamic height based on number of rows in active keyset
  const previewHeight = useMemo(() => {
    const activeKeyset = state.config.keysets.find(ks => ks.id === state.activeKeyset);
    const numRows = activeKeyset?.rows?.length || 4;

    // Height calculation (no suggestions bar in preview):
    // - Each row: ~50px
    // - Row spacing: ~10px between rows
    const rowHeight = 50;
    const rowSpacing = 10;

    return (numRows * rowHeight) + ((numRows - 1) * rowSpacing);
  }, [state.config.keysets, state.activeKeyset]);

  return (
    <View style={styles.container}>
      {/* Preview Header */}
      <View style={styles.previewHeader}>
        <Text style={styles.previewLabel}>Preview</Text>
        <View style={styles.languageBadge}>
          <Text style={styles.languageBadgeText}>
            {languageDisplayName}
          </Text>
        </View>
      </View>

      {/* Keyboard Preview */}
      <KeyboardPreview
        style={[styles.preview, { height: previewHeight }]}
        configJson={configJson}
        onKeyPress={handleKeyPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A7181',
  },
  languageBadge: {
    backgroundColor: '#39AC86',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  languageBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  preview: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: "#CBCFD8"
  },
});

export default InteractiveCanvas;