import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { DiacriticItem, DiacriticModifier, DiacriticsDefinition } from '../../../types';

interface DiacriticItemRowProps {
  item: DiacriticItem;
  isHidden: boolean;
  onToggle: (id: string) => void;
  sampleLetter: string;
}

const DiacriticItemRow: React.FC<DiacriticItemRowProps> = ({
  item,
  isHidden,
  onToggle,
  sampleLetter,
}) => {
  // Show a sample of the diacritic with a letter
  const sample = item.isReplacement ? item.mark : (sampleLetter + item.mark);
  
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemSample}>{sample}</Text>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemId}>({item.id})</Text>
      </View>
      <Switch
        value={!isHidden}
        onValueChange={() => onToggle(item.id)}
        trackColor={{ false: '#ccc', true: '#81C784' }}
        thumbColor={!isHidden ? '#4CAF50' : '#f4f3f4'}
      />
    </View>
  );
};

interface ModifierRowProps {
  modifier: DiacriticModifier;
  isEnabled: boolean;
  onToggle: (id: string) => void;
  sampleLetter: string;
}

const ModifierRow: React.FC<ModifierRowProps> = ({
  modifier,
  isEnabled,
  onToggle,
  sampleLetter,
}) => {
  // Show sample - for multi-option show first option, for simple show mark
  let sample = sampleLetter;
  if (modifier.options && modifier.options.length > 0) {
    sample = sampleLetter + modifier.options[0].mark;
  } else if (modifier.mark) {
    sample = sampleLetter + modifier.mark;
  }
  
  return (
    <View style={[styles.itemRow, styles.modifierRow]}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemSample}>{sample}</Text>
        <Text style={styles.itemName}>{modifier.name}</Text>
        <Text style={styles.itemId}>({modifier.id})</Text>
        {modifier.options && (
          <Text style={styles.multiOptionLabel}>
            ({modifier.options.length} options)
          </Text>
        )}
      </View>
      <Switch
        value={isEnabled}
        onValueChange={() => onToggle(modifier.id)}
        trackColor={{ false: '#ccc', true: '#81C784' }}
        thumbColor={isEnabled ? '#4CAF50' : '#f4f3f4'}
      />
    </View>
  );
};

export const DiacriticsPanel: React.FC = () => {
  const { state, dispatch } = useEditor();
  
  // Determine which keyboard is currently shown based on the active keyset
  const keyboards = state.config.keyboards || [];
  const currentKeysetId = state.activeKeyset || state.config.defaultKeyset || '';
  
  // Derive keyboard ID from keyset ID (e.g., "he_abc" -> "he", "abc" -> first keyboard)
  let currentKeyboardId = '';
  for (const kb of keyboards) {
    if (currentKeysetId.startsWith(kb + '_')) {
      currentKeyboardId = kb;
      break;
    }
  }
  // If keyset doesn't have a prefix (like "abc"), it's the first keyboard
  if (!currentKeyboardId && !currentKeysetId.includes('_') && keyboards.length > 0) {
    currentKeyboardId = keyboards[0];
  }
  
  // Get diacritics for the current keyboard from allDiacritics ONLY
  // Don't fall back to legacy diacritics - that would show Hebrew diacritics for English
  const allDiacritics = state.config.allDiacritics || {};
  const diacritics = allDiacritics[currentKeyboardId];
  
  // Get keyboard display name
  const keyboardDisplayName = currentKeyboardId === 'he' ? 'Hebrew' :
    currentKeyboardId === 'ar' ? 'Arabic' :
    currentKeyboardId === 'en' ? 'English' :
    currentKeyboardId || 'Unknown';
  
  console.log(`[DiacriticsPanel] Current keyboard: ${currentKeyboardId}, has diacritics: ${!!diacritics}, allDiacritics keys: ${Object.keys(allDiacritics).join(', ')}`);
  
  const settings = state.config.diacriticsSettings?.[currentKeyboardId] || {};
  const hiddenItems = settings.hidden || [];
  const disabledModifiers = settings.disabledModifiers || [];
  const isNikkudDisabled = settings.disabled || false;
  
  // Sample letter for preview based on keyboard language
  const sampleLetter = useMemo(() => {
    // Use keyboard-specific sample letters
    switch (currentKeyboardId) {
      case 'he':
        return 'ב';  // Hebrew bet
      case 'ar':
        return 'ب';  // Arabic ba
      default:
        // Try to find from diacritics onlyFor
        if (diacritics) {
          const firstOnlyFor = diacritics.items.find(i => i.onlyFor)?.onlyFor;
          if (firstOnlyFor && firstOnlyFor.length > 0) {
            return firstOnlyFor[0];
          }
        }
        return 'X';  // Generic fallback
    }
  }, [currentKeyboardId, diacritics]);
  
  const handleToggleItem = (itemId: string) => {
    const newHidden = hiddenItems.includes(itemId)
      ? hiddenItems.filter(id => id !== itemId)
      : [...hiddenItems, itemId];
    
    console.log('[DiacriticsPanel] Toggling item:', itemId);
    console.log('[DiacriticsPanel] New hidden:', newHidden);
    console.log('[DiacriticsPanel] Keyboard ID:', currentKeyboardId);
    
    dispatch({
      type: 'UPDATE_DIACRITICS_SETTINGS',
      payload: {
        keyboardId: currentKeyboardId,
        settings: { ...settings, hidden: newHidden },
      },
    });
  };
  
  const handleToggleModifier = (modifierId: string) => {
    // Toggle individual modifier
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
        <Text style={styles.emptyText}>
          No diacritics available for this keyboard.
        </Text>
        <Text style={styles.emptySubtext}>
          Diacritics settings are available for keyboards with Hebrew, Arabic, or other diacritical marks.
        </Text>
      </View>
    );
  }
  
  // Get modifiers (from new modifiers array or fallback to single modifier)
  const modifiers: DiacriticModifier[] = diacritics.modifiers || 
    (diacritics.modifier ? [diacritics.modifier] : []);
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diacritics (Nikkud/Tashkil)</Text>
        <Text style={styles.sectionSubtitle}>
          Toggle which diacritics appear in the picker
        </Text>
        
        {diacritics.items.map(item => {
          // Skip "plain" item - it should always be available as the "no diacritic" option
          if (item.id === 'plain') {
            return null;
          }
          return (
            <DiacriticItemRow
              key={item.id}
              item={item}
              isHidden={hiddenItems.includes(item.id)}
              onToggle={handleToggleItem}
              sampleLetter={sampleLetter}
            />
          );
        })}
      </View>
      
      {modifiers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Modifiers</Text>
          <Text style={styles.sectionSubtitle}>
            Toggle modifier options (dagesh, shin/sin dots, etc.)
          </Text>
          
          {modifiers.map(modifier => (
            <ModifierRow
              key={modifier.id}
              modifier={modifier}
              isEnabled={!disabledModifiers.includes(modifier.id)}
              onToggle={handleToggleModifier}
              sampleLetter={sampleLetter}
            />
          ))}
        </View>
      )}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Disable Nikkud</Text>
        <Text style={styles.sectionSubtitle}>
          Completely disable nikkud for this keyboard (hides the nikkud key)
        </Text>
        
        <View style={styles.disableRow}>
          <View style={styles.disableInfo}>
            <Text style={styles.disableLabel}>Disable Nikkud</Text>
            <Text style={styles.disableDescription}>
              When disabled, the nikkud key will be hidden from the keyboard
            </Text>
          </View>
          <Switch
            value={isNikkudDisabled}
            onValueChange={(value) => {
              dispatch({
                type: 'UPDATE_DIACRITICS_SETTINGS',
                payload: {
                  keyboardId: currentKeyboardId,
                  settings: { ...settings, disabled: value },
                },
              });
            }}
            trackColor={{ false: '#ccc', true: '#EF5350' }}
            thumbColor={isNikkudDisabled ? '#D32F2F' : '#f4f3f4'}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    marginBottom: 8,
  },
  modifierRow: {
    backgroundColor: '#FFF8E1',
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemSample: {
    fontSize: 24,
    width: 40,
    textAlign: 'center',
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  itemId: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  multiOptionLabel: {
    fontSize: 11,
    color: '#FF9800',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  disableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    marginBottom: 8,
  },
  disableInfo: {
    flex: 1,
    marginRight: 12,
  },
  disableLabel: {
    fontSize: 14,
    color: '#C62828',
    fontWeight: '600',
    marginBottom: 4,
  },
  disableDescription: {
    fontSize: 12,
    color: '#666',
  },
});

export default DiacriticsPanel;