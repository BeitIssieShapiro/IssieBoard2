import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { KeyboardPreview, KeyPressEvent } from '../KeyboardPreview';
import { useEditor } from '../../context/EditorContext';
import { useLocalization } from '../../localization';

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
import { filterSettingsButton, transformConfigForPreview } from '../../utils/keyboardConfigMerger';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface InteractiveCanvasProps {
  onTestInput?: (text: string) => void;
  height: number;
  hideHeader?: boolean;
  hideSettingsKey?: boolean;
  /** When 'advanced', the preview uses the native-reported keyboard height for a realistic preview */
  activeTab?: string;
}

// Language display names
const LANGUAGE_NAMES: Record<string, string> = {
  'he': 'עברית',
  'en': 'English',
  'ar': 'العربية',
};

export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({ onTestInput, height, hideHeader, hideSettingsKey, activeTab }) => {
  const { state, dispatch } = useEditor();
  const { strings } = useLocalization();
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets()

  // Get language display name from keyboard ID
  const languageDisplayName = useMemo(() => {
    const keyboardId = state.config.keyboards?.[0] || 'en';
    // Handle variants like 'he_ordered' -> 'he', 'en' -> 'en'
    const baseLanguage = keyboardId.split('_')[0];
    return LANGUAGE_NAMES[baseLanguage] || LANGUAGE_NAMES['en'] || 'English';
  }, [state.config.keyboards]);

  const handleHeightChange = useCallback((event: any) => {
    const { height: calculatedHeight } = event.nativeEvent;
    console.log('📐 [InteractiveCanvas] Keyboard height changed from native:', calculatedHeight);
    setKeyboardHeight(calculatedHeight);
  }, []);

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
    console.log(`🎨 [InteractiveCanvas] Converting ${state.styleGroups.length} styleGroups to groups`);

    const groupConfigs = state.styleGroups
      .filter(group => {
        const isActive = group.active !== false;
        console.log(`🎨 Group "${group.name}": active=${isActive}, members=${group.members?.length || 0}, bgColor=${group.style.bgColor}`);
        return isActive;
      })
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

    console.log(`🎨 [InteractiveCanvas] Created ${groupConfigs.length} group configs`);
    if (groupConfigs.length > 0) {
      console.log(`🎨 [InteractiveCanvas] Sample group:`, JSON.stringify(groupConfigs[0]));
    }

    // Get settingsButtonEnabled setting (default to true, but force false if hideSettingsKey)
    const settingsButtonEnabled = hideSettingsKey ? false : state.config.settingsButtonEnabled !== false;

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
    // IMPORTANT: Preserve all config properties (heightPreset, fontSizePreset, colors, etc.)
    const previewConfig: KeyboardConfig = {
      ...state.config,
      keysets: filteredKeysets,
      groups: groupConfigs,
      wordSuggestionsEnabled: false,
    };

    return previewConfig;
  }, [state.config, state.styleGroups]);

  const configJson = useMemo(() => {
    return JSON.stringify(transformConfigForPreview(configWithGroups));
  }, [configWithGroups]);

  console.log("📐 [InteractiveCanvas] Render - keyboardHeight:", keyboardHeight, "containerHeight:", height, "windowWidth:", windowWidth);

  const isLandscape = windowWidth > windowHeight;
  const windowAvailableWidth = windowWidth - insets.left - insets.right
  // In advanced tab, use native-reported height for realistic preview
  const useRealisticHeight = activeTab === 'advanced' && keyboardHeight > 0;
  const effectiveHeight = useRealisticHeight ? keyboardHeight : height;

  return (
    <View style={{ flexDirection: isLandscape && !hideHeader ? "row" : "column", minHeight: hideHeader ? effectiveHeight : height + 20 }}>

      {/* Preview Header */}
      {!hideHeader && (
      <View style={isLandscape ? styles.previewHeaderLandscape : styles.previewHeader}>
        <Text allowFontScaling={false} style={styles.previewLabel}>{strings.canvas.preview}</Text>
        <View style={[styles.languageBadge]}>
          <Text allowFontScaling={false} style={styles.languageBadgeText}>
            {languageDisplayName}
          </Text>
        </View>
      </View>
      )}

      {/* Keyboard Preview */}
      <View style={{
        width: isLandscape && !hideHeader ? windowAvailableWidth * 0.8 : '100%',
        alignItems: 'center',
        justifyContent:"center",
        height: hideHeader ? effectiveHeight : Math.max(height, keyboardHeight) - 50,
        marginTop: isLandscape && !hideHeader ? 10 : 0,
      }}>
        <KeyboardPreview
          key={`editor-preview-${windowAvailableWidth}`}
          style={[
            styles.preview,
            {
              height: hideHeader ? effectiveHeight : Math.max(height - 40, keyboardHeight),
              width: isLandscape && !hideHeader ? windowAvailableWidth * 0.78 : '100%',
            }
          ]}
          configJson={configJson}
          maxHeight={useRealisticHeight ? undefined : height}
          onKeyPress={handleKeyPress}
          onHeightChange={handleHeightChange}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({

  previewHeader: {
    margin: 5,
    marginStart: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
    height: 40,
  },
  previewHeaderLandscape: {
    margin: 5,
    marginStart: 16,
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: "15%",
  },

  previewLabel: {
    fontSize: 19,
    fontWeight: '600',
    color: '#111827',
  },
  languageBadge: {
    backgroundColor: '#39AC86',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    width: 100,
    textAlign: "center"
  },
  languageBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    textAlign:"center"
  },
  dimensionsText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  previewWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    width: "100%",
  },
  preview: {
    overflow: 'hidden',
    backgroundColor: "#CBCFD8"
  },
});

export default InteractiveCanvas;