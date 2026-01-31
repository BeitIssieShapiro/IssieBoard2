import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { ColorPicker } from '../shared/ColorPicker';

// Background color presets
const BACKGROUND_PRESETS = [
  '#E0E0E0', '#FFFFFF', '#F5F5F5', '#263238',
  '#1A237E', '#1B5E20', '#B71C1C', '#F3E5F5',
  '#E8F5E9', '#FFF3E0', '#E3F2FD', '#FFEBEE',
];

export interface KeyboardVariantOption {
  id: string;
  name: string;
}

export interface GlobalSettingsPanelProps {
  /** Available keyboard variants for current language */
  keyboardVariants?: KeyboardVariantOption[];
  /** Currently selected keyboard variant */
  currentKeyboardId?: string;
  /** Callback when keyboard variant changes */
  onKeyboardVariantChange?: (keyboardId: string) => void;
}

export const GlobalSettingsPanel: React.FC<GlobalSettingsPanelProps> = ({
  keyboardVariants,
  currentKeyboardId,
  onKeyboardVariantChange,
}) => {
  const { 
    state, 
    updateBackgroundColor,
    updateWordSuggestions,
  } = useEditor();

  // Get current word suggestions setting (default to true)
  const wordSuggestionsEnabled = state.config.wordSuggestionsEnabled !== false;

  // Calculate stats
  const stats = useMemo(() => {
    let totalKeys = 0;
    state.config.keysets.forEach(keyset => {
      keyset.rows.forEach(row => {
        totalKeys += row.keys.length;
      });
    });

    const hiddenKeyIds = new Set<string>();
    state.styleGroups.forEach(group => {
      if (group.style.hidden) {
        group.members.forEach(keyId => hiddenKeyIds.add(keyId));
      }
    });

    const styledKeyIds = new Set<string>();
    state.styleGroups.forEach(group => {
      group.members.forEach(keyId => styledKeyIds.add(keyId));
    });

    return {
      totalKeys,
      hiddenKeys: hiddenKeyIds.size,
      styledKeys: styledKeyIds.size,
      groupCount: state.styleGroups.length,
    };
  }, [state.config.keysets, state.styleGroups]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Keyboard Layout (only show if multiple variants available) */}
      {keyboardVariants && keyboardVariants.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Keyboard Layout</Text>
          <View style={styles.variantSelector}>
            {keyboardVariants.map(variant => (
              <TouchableOpacity
                key={variant.id}
                style={[
                  styles.variantButton,
                  currentKeyboardId === variant.id && styles.variantButtonActive,
                ]}
                onPress={() => onKeyboardVariantChange?.(variant.id)}
              >
                <Text style={[
                  styles.variantButtonText,
                  currentKeyboardId === variant.id && styles.variantButtonTextActive,
                ]}>
                  {variant.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Background Color */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Background Color</Text>
        <ColorPicker
          value={state.config.backgroundColor || ''}
          onChange={updateBackgroundColor}
          presets={BACKGROUND_PRESETS}
          showSystemDefault
          systemDefaultLabel="Default"
        />
      </View>

      {/* Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>
        <View style={styles.featureRow}>
          <View style={styles.featureInfo}>
            <Text style={styles.featureLabel}>Word Suggestions</Text>
            <Text style={styles.featureDescription}>
              Show word completion suggestions above keyboard
            </Text>
          </View>
          <Switch
            value={wordSuggestionsEnabled}
            onValueChange={updateWordSuggestions}
            trackColor={{ false: '#CCCCCC', true: '#81C784' }}
            thumbColor={wordSuggestionsEnabled ? '#4CAF50' : '#F5F5F5'}
          />
        </View>
      </View>

      {/* Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalKeys}</Text>
            <Text style={styles.statLabel}>Total Keys</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, stats.hiddenKeys > 0 && styles.statValueWarning]}>
              {stats.hiddenKeys}
            </Text>
            <Text style={styles.statLabel}>Hidden</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, stats.styledKeys > 0 && styles.statValueHighlight]}>
              {stats.styledKeys}
            </Text>
            <Text style={styles.statLabel}>Styled</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.groupCount}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
        </View>
      </View>

      {/* Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>💡 Quick Tips</Text>
        <Text style={styles.tipsText}>
          • Tap a key to select and edit it{'\n'}
          • Changes create Style Groups automatically{'\n'}
          • Delete a group to restore keys to default{'\n'}
          • Switch to Groups tab to manage all groups
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  content: { padding: 16, paddingBottom: 32 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 },
  variantSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
  },
  variantButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  variantButtonActive: {
    backgroundColor: '#2196F3',
  },
  variantButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  variantButtonTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  featureInfo: { flex: 1, marginRight: 12 },
  featureLabel: { fontSize: 15, fontWeight: '500', color: '#333' },
  featureDescription: { fontSize: 12, color: '#666', marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  statValueWarning: { color: '#FF9800' },
  statValueHighlight: { color: '#2196F3' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  tipsSection: { backgroundColor: '#E3F2FD', padding: 16, borderRadius: 12, marginTop: 8 },
  tipsTitle: { fontSize: 14, fontWeight: '600', color: '#1976D2', marginBottom: 8 },
  tipsText: { fontSize: 12, color: '#333', lineHeight: 18 },
});

export default GlobalSettingsPanel;