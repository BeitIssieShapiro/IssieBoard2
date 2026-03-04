import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { DiacriticItem, DiacriticModifier } from '../../../types';
import { ButtonGroupRow } from '../shared/ButtonGroupRow';
import { ToggleSwitch } from '../shared/ToggleSwitch';

type NikkudMode = 'basic' | 'full' | 'custom' | 'none';

interface NikkudKeyProps {
  item: DiacriticItem | DiacriticModifier;
  sampleLetter: string;
  isSelected: boolean;
  onToggle: () => void;
  isModifier?: boolean;
}

const NikkudKey: React.FC<NikkudKeyProps> = ({
  item,
  sampleLetter,
  isSelected,
  onToggle,
  isModifier,
}) => {
  // Build the sample display
  let sample = sampleLetter;
  if ('isReplacement' in item && item.isReplacement) {
    sample = item.mark;
  } else if ('options' in item && item.options && item.options.length > 0) {
    // Modifier with options - show first option
    sample = sampleLetter + item.options[0].mark;
  } else {
    sample = sampleLetter + item.mark;
  }

  return (
    <TouchableOpacity
      style={[
        styles.nikkudKey,
        isSelected && styles.nikkudKeySelected,
        isModifier && styles.nikkudKeyModifier,
      ]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Text allowFontScaling={false} style={styles.nikkudKeySample}>{sample}</Text>
      <Text allowFontScaling={false} style={styles.nikkudKeyName}>{item.name}</Text>
    </TouchableOpacity>
  );
};

export const DiacriticsPanel: React.FC = () => {
  const { state, dispatch } = useEditor();
  
  // Determine which keyboard is currently shown
  const keyboards = state.config.keyboards || [];
  const currentKeysetId = state.activeKeyset || state.config.defaultKeyset || '';
  
  let currentKeyboardId = '';
  for (const kb of keyboards) {
    if (currentKeysetId.startsWith(kb + '_')) {
      currentKeyboardId = kb;
      break;
    }
  }
  if (!currentKeyboardId && !currentKeysetId.includes('_') && keyboards.length > 0) {
    currentKeyboardId = keyboards[0];
  }
  
  // Get diacritics for current keyboard
  const allDiacritics = state.config.allDiacritics || {};
  const diacritics = allDiacritics[currentKeyboardId];
  
  const settings = state.config.diacriticsSettings?.[currentKeyboardId] || {};
  const hiddenItems = settings.hidden || [];
  const disabledModifiers = settings.disabledModifiers || [];
  const isNikkudDisabled = settings.disabled || false;
  const isSimpleMode = settings.simpleMode ?? true;
  
  // Determine current mode based on settings
  const getCurrentMode = (): NikkudMode => {
    if (isNikkudDisabled) return 'none';
    if (isSimpleMode && hiddenItems.length === 0 && disabledModifiers.length === 0) return 'basic';
    if (!isSimpleMode && hiddenItems.length === 0 && disabledModifiers.length === 0) return 'full';
    return 'custom';
  };

  const [currentMode, setCurrentMode] = useState<NikkudMode>(getCurrentMode());

  // Sample letter
  const sampleLetter = useMemo(() => {
    switch (currentKeyboardId) {
      case 'he':
        return 'ב';
      case 'ar':
        return 'ب';
      default:
        return 'X';
    }
  }, [currentKeyboardId]);

  const handleModeChange = (mode: NikkudMode) => {
    setCurrentMode(mode);
    
    switch (mode) {
      case 'none':
        // Disable nikkud completely
        dispatch({
          type: 'UPDATE_DIACRITICS_SETTINGS',
          payload: {
            keyboardId: currentKeyboardId,
            settings: { ...settings, disabled: true },
          },
        });
        break;
      
      case 'basic':
        // Simple mode, no hidden items or disabled modifiers
        dispatch({
          type: 'UPDATE_DIACRITICS_SETTINGS',
          payload: {
            keyboardId: currentKeyboardId,
            settings: { disabled: false, simpleMode: true, hidden: [], disabledModifiers: [] },
          },
        });
        break;
      
      case 'full':
        // Full mode (not simple), no hidden items or disabled modifiers
        dispatch({
          type: 'UPDATE_DIACRITICS_SETTINGS',
          payload: {
            keyboardId: currentKeyboardId,
            settings: { disabled: false, simpleMode: false, hidden: [], disabledModifiers: [] },
          },
        });
        break;
      
      case 'custom':
        // Enable custom mode - add a non-existent item to hidden to force custom mode
        // This ensures getCurrentMode() returns 'custom'
        dispatch({
          type: 'UPDATE_DIACRITICS_SETTINGS',
          payload: {
            keyboardId: currentKeyboardId,
            settings: { 
              disabled: false, 
              simpleMode: true,
              hidden: hiddenItems.length > 0 ? hiddenItems : ['__custom_mode_marker__'],
              disabledModifiers: disabledModifiers.length > 0 ? disabledModifiers : [],
            },
          },
        });
        break;
    }
  };

  const handleToggleItem = (itemId: string) => {
    const newHidden = hiddenItems.includes(itemId)
      ? hiddenItems.filter(id => id !== itemId)
      : [...hiddenItems, itemId];
    
    dispatch({
      type: 'UPDATE_DIACRITICS_SETTINGS',
      payload: {
        keyboardId: currentKeyboardId,
        settings: { ...settings, hidden: newHidden },
      },
    });
  };

  const handleToggleModifier = (modifierId: string) => {
    const newDisabledModifiers = disabledModifiers.includes(modifierId)
      ? disabledModifiers.filter(id => id !== modifierId)
      : [...disabledModifiers, modifierId];
    
    dispatch({
      type: 'UPDATE_DIACRITICS_SETTINGS',
      payload: {
        keyboardId: currentKeyboardId,
        settings: { ...settings, disabledModifiers: newDisabledModifiers },
      },
    });
  };
  
  if (!diacritics) {
    return (
      <View style={styles.emptyContainer}>
        <Text allowFontScaling={false} style={styles.emptyText}>
          No diacritics available for this keyboard.
        </Text>
      </View>
    );
  }
  
  const modifiers: DiacriticModifier[] = diacritics.modifiers || 
    (diacritics.modifier ? [diacritics.modifier] : []);
  
  const basicItems = diacritics.items.filter(item => item.id !== 'plain' && !item.isAdvanced);
  const advancedItems = diacritics.items.filter(item => item.isAdvanced);
  const allItems = [...basicItems, ...advancedItems];
  
  return (
    <View style={styles.container}>
      {/* Mode Selector */}
      <ButtonGroupRow
        title="Enable Nikkud (Diacritics)"
        options={[
          { id: 'basic', label: 'Basic' },
          { id: 'full', label: 'Full' },
          { id: 'custom', label: 'Custom' },
          { id: 'none', label: 'None' },
        ]}
        selectedId={currentMode}
        onSelect={(id) => handleModeChange(id as NikkudMode)}
      />

      {/* Custom Mode - Show all nikkud options as toggleable keys */}
      {currentMode === 'custom' && (
        <View style={styles.section}>
          <Text allowFontScaling={false} style={styles.sectionTitle}>Diacritics</Text>
          <View style={styles.nikkudGrid}>
            {allItems.map(item => (
              <NikkudKey
                key={item.id}
                item={item}
                sampleLetter={sampleLetter}
                isSelected={!hiddenItems.includes(item.id)}
                onToggle={() => handleToggleItem(item.id)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Modifiers - Show for all modes except None */}
      {currentMode !== 'none' && modifiers.length > 0 && (
        <View style={styles.section}>
          <Text allowFontScaling={false} style={[styles.sectionTitle, currentMode === 'custom' && { marginTop: 16 }]}>
            Modifiers
          </Text>
          {modifiers.map((modifier) => (
            <View key={modifier.id} style={styles.modifierRow}>
              <View style={styles.modifierInfo}>
                <Text allowFontScaling={false} style={styles.modifierName}>{modifier.name}</Text>
                {modifier.options && modifier.options.length > 0 && (
                  <Text allowFontScaling={false} style={styles.modifierOptions}>
                    {modifier.options.map(opt => opt.name).join(', ')}
                  </Text>
                )}
              </View>
              <ToggleSwitch
                value={!disabledModifiers.includes(modifier.id)}
                onChange={() => handleToggleModifier(modifier.id)}
                labelOn=""
                labelOff=""
                size="medium"
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  emptyContainer: {
    padding: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#DDD',
  },
  nikkudGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nikkudKey: {
    width: 80,
    height: 70,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  nikkudKeySelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  nikkudKeyModifier: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFB74D',
  },
  nikkudKeySample: {
    fontSize: 24,
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  nikkudKeyName: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  modifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  modifierInfo: {
    flex: 1,
    marginRight: 12,
  },
  modifierName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  modifierOptions: {
    fontSize: 11,
    color: '#666',
  },
});

export default DiacriticsPanel;