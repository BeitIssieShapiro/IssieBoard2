import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { ColorPicker } from '../shared/ColorPicker';

// Background color presets
const BACKGROUND_PRESETS = [
  '#E0E0E0', '#FFFFFF', '#F5F5F5', '#263238',
  '#1A237E', '#1B5E20', '#B71C1C', '#F3E5F5',
  '#E8F5E9', '#FFF3E0', '#E3F2FD', '#FFEBEE',
];

export const GlobalSettingsPanel: React.FC = () => {
  const { 
    state, 
    updateBackgroundColor,
  } = useEditor();

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
      {/* Background Color */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Background Color</Text>
        <ColorPicker
          value={state.config.backgroundColor}
          onChange={updateBackgroundColor}
          presets={BACKGROUND_PRESETS}
        />
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