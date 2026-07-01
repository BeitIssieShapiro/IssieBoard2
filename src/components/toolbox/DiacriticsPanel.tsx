import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { useLocalization } from '../../localization';
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
    const base = ('sampleBase' in item && item.sampleBase) ? item.sampleBase : sampleLetter;
    sample = base + item.mark;
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
  const { strings, isRTL } = useLocalization();
  
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
  const isTopRowMode = settings.nikkudMode === 'topRow';
  const isTopRowAlways = settings.nikkudMode === 'topRowAlways';
  
  // Determine current mode based on settings — computed directly so it resets on cancel
  const currentMode: NikkudMode = (() => {
    if (isNikkudDisabled) return 'none';
    if (isSimpleMode && hiddenItems.length === 0 && disabledModifiers.length === 0) return 'basic';
    if (!isSimpleMode && hiddenItems.length === 0 && disabledModifiers.length === 0) return 'full';
    return 'custom';
  })();

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

    switch (mode) {
      case 'none':
        dispatch({
          type: 'UPDATE_DIACRITICS_SETTINGS',
          payload: {
            keyboardId: currentKeyboardId,
            settings: { ...settings, disabled: true, nikkudMode: undefined },
          },
        });
        break;

      case 'basic':
        dispatch({
          type: 'UPDATE_DIACRITICS_SETTINGS',
          payload: {
            keyboardId: currentKeyboardId,
            settings: { ...settings, disabled: false, simpleMode: true, hidden: [], disabledModifiers: [] },
          },
        });
        break;

      case 'full':
        dispatch({
          type: 'UPDATE_DIACRITICS_SETTINGS',
          payload: {
            keyboardId: currentKeyboardId,
            settings: { ...settings, disabled: false, simpleMode: false, hidden: [], disabledModifiers: [] },
          },
        });
        break;

      case 'custom': {
        const allDiacriticsItems = diacritics
          ? [...(diacritics.items || []).filter(i => i.id !== 'plain')]
          : [];
        const allModifiers: DiacriticModifier[] = diacritics
          ? (diacritics.modifiers || (diacritics.modifier ? [diacritics.modifier] : []))
          : [];
        dispatch({
          type: 'UPDATE_DIACRITICS_SETTINGS',
          payload: {
            keyboardId: currentKeyboardId,
            settings: {
              ...settings,
              disabled: false,
              simpleMode: true,
              hidden: allDiacriticsItems.map(i => i.id),
              disabledModifiers: allModifiers.map(m => m.id),
            },
          },
        });
        break;
      }
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
          {strings.diacritics.noDiacritics}
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
    <View style={[styles.container]}>
      {/* Mode Selector */}
      <ButtonGroupRow
        isRTL={isRTL}
        title={strings.diacritics.enableNikkud}
        options={[
          { id: 'basic', label: strings.diacritics.basic },
          { id: 'full', label: strings.diacritics.full },
          { id: 'custom', label: strings.diacritics.custom },
          { id: 'none', label: strings.common.none },
        ]}
        selectedId={currentMode}
        onSelect={(id) => handleModeChange(id as NikkudMode)}
      />

      {/* Input Mode selector — visible when nikkud is enabled */}
      {currentMode !== 'none' && (
        <>
          <View style={styles.divider} />
          <ButtonGroupRow
            isRTL={isRTL}
            title={strings.diacritics.inputMode}
            options={[
              { id: 'popup', label: strings.diacritics.popup },
              { id: 'topRow', label: strings.diacritics.topRow },
              { id: 'topRowAlways', label: strings.diacritics.topRowAlways },
            ]}
            selectedId={isTopRowAlways ? 'topRowAlways' : isTopRowMode ? 'topRow' : 'popup'}
            onSelect={(id) => {
              dispatch({
                type: 'UPDATE_DIACRITICS_SETTINGS',
                payload: {
                  keyboardId: currentKeyboardId,
                  settings: { ...settings, nikkudMode: id as 'popup' | 'topRow' | 'topRowAlways' },
                },
              });
            }}
          />
        </>
      )}

      {/* Custom Mode - Show all nikkud options as toggleable keys */}
      {currentMode === 'custom' && (
        <View style={styles.section}>
          <Text allowFontScaling={false} style={[styles.sectionTitle]}>{strings.diacritics.diacriticsSection}</Text>
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
          <View style={styles.divider} />
          <Text allowFontScaling={false} style={styles.sectionTitle}>
            {strings.diacritics.modifiers}
          </Text>
          {modifiers.map((modifier) => (
            <View key={modifier.id} style={[styles.modifierRow]}>
              <View style={[styles.modifierInfo, isRTL && { marginRight: 0, marginLeft: 12 }]}>
                <Text allowFontScaling={false} style={styles.modifierName}>{modifier.name}</Text>
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
    padding:12
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
    marginTop: 0,
  },
  divider: {
    height: 0.5,
    backgroundColor: '#DDD',
    marginVertical: 8,
  },
  sectionTitle: {
    textAlign: 'left',
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
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
    fontSize: 30,
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
    textAlign:"left"
  },
  modifierOptions: {
    fontSize: 11,
    color: '#666',
    textAlign:"left"
  },
});

export default DiacriticsPanel;