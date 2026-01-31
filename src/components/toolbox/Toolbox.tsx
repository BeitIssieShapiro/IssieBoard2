import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { GlobalSettingsPanel } from './GlobalSettingsPanel';
import { StyleRulesPanel } from './StyleRulesPanel';
import { DiacriticsPanel } from './DiacriticsPanel';

type TabId = 'settings' | 'styleRules' | 'diacritics';

export interface KeyboardVariantOption {
  id: string;
  name: string;
}

export interface ToolboxProps {
  /** Available keyboard variants for current language */
  keyboardVariants?: KeyboardVariantOption[];
  /** Currently selected keyboard variant */
  currentKeyboardId?: string;
  /** Callback when keyboard variant changes */
  onKeyboardVariantChange?: (keyboardId: string) => void;
}

export const Toolbox: React.FC<ToolboxProps> = ({
  keyboardVariants,
  currentKeyboardId,
  onKeyboardVariantChange,
}) => {
  const { state, clearSelection } = useEditor();
  const [activeTab, setActiveTab] = useState<TabId>('settings');

  // Clear selection when switching tabs
  const handleTabChange = (tab: TabId) => {
    if (tab !== activeTab) {
      clearSelection();
      setActiveTab(tab);
    }
  };

  // Show tabbed interface for global settings, style rules, and nikkud
  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
          onPress={() => handleTabChange('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
            ⚙️ Settings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'styleRules' && styles.tabActive]}
          onPress={() => handleTabChange('styleRules')}
        >
          <Text style={[styles.tabText, activeTab === 'styleRules' && styles.tabTextActive]}>
            🎨 Style Rules
            {state.styleGroups.length > 0 && (
              <Text style={styles.badge}> ({state.styleGroups.length})</Text>
            )}
          </Text>
        </TouchableOpacity>
        {state.config.diacritics && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'diacritics' && styles.tabActive]}
            onPress={() => handleTabChange('diacritics')}
          >
            <Text style={[styles.tabText, activeTab === 'diacritics' && styles.tabTextActive]}>
              ◌ָ Nikkud
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'settings' && (
          <GlobalSettingsPanel
            keyboardVariants={keyboardVariants}
            currentKeyboardId={currentKeyboardId}
            onKeyboardVariantChange={onKeyboardVariantChange}
          />
        )}
        {activeTab === 'styleRules' && <StyleRulesPanel />}
        {activeTab === 'diacritics' && <DiacriticsPanel />}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FAFAFA',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2196F3',
    backgroundColor: '#FFF',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#2196F3',
    fontWeight: '600',
  },
  badge: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
});

export default Toolbox;