import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { KeyEditorPanel } from './KeyEditorPanel';
import { GlobalSettingsPanel } from './GlobalSettingsPanel';
import { GroupsPanel } from './GroupsPanel';

type TabId = 'settings' | 'groups';

export const Toolbox: React.FC = () => {
  const { state } = useEditor();
  const [activeTab, setActiveTab] = useState<TabId>('settings');

  // If keys are selected, show key editor
  if (state.selectedKeys.length > 0) {
    return <KeyEditorPanel />;
  }

  // Otherwise show tabbed interface for global settings and groups
  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
            ⚙️ Settings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>
            📦 Groups
            {state.styleGroups.length > 0 && (
              <Text style={styles.badge}> ({state.styleGroups.length})</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'settings' ? <GlobalSettingsPanel /> : <GroupsPanel />}
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