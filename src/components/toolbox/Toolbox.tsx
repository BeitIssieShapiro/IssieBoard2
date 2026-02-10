import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useEditor, getKeyValueFromPositionId } from '../../context/EditorContext';
import { GlobalSettingsPanel } from './GlobalSettingsPanel';
import { StyleRulesPanel } from './StyleRulesPanel';
import { DiacriticsPanel } from './DiacriticsPanel';
import { ActionButton } from '../shared/ActionButton';
import { AddStyleRuleModal } from './AddStyleRuleModal';
import { StyleGroup } from '../../../types';

type SectionId = 'settings' | 'styleRules' | 'diacritics';

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
  const [showStyleRuleModal, setShowStyleRuleModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StyleGroup | null>(null);
  
  // All accordions open by default
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    new Set(['settings', 'styleRules', 'diacritics'])
  );

  // Convert currently selected position IDs to key values
  const getSelectedKeyValues = useCallback((): string[] => {
    if (state.selectedKeys.length === 0) return [];
    
    const keyValues = state.selectedKeys
      .map(posId => getKeyValueFromPositionId(posId, state.config.keysets))
      .filter((v): v is string => v !== null);
    
    return [...new Set(keyValues)]; // Remove duplicates
  }, [state.selectedKeys, state.config.keysets]);

  const handleCreatePressed = useCallback(() => {
    setEditingGroup(null);
    setShowStyleRuleModal(true);
  }, []);

  const handleEditPressed = useCallback((group: StyleGroup) => {
    setEditingGroup(group);
    setShowStyleRuleModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowStyleRuleModal(false);
    setEditingGroup(null);
    clearSelection();
  }, [clearSelection]);

  const toggleSection = (sectionId: SectionId) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const AccordionSection = ({ 
    id, 
    title, 
    badge, 
    actionButton,
    children 
  }: { 
    id: SectionId; 
    title: string; 
    badge?: string;
    actionButton?: React.ReactNode;
    children: React.ReactNode;
  }) => {
    const isOpen = openSections.has(id);
    
    return (
      <View style={styles.accordionSection}>
        <TouchableOpacity 
          style={styles.accordionHeader}
          onPress={() => toggleSection(id)}
          activeOpacity={0.7}
        >
          <View style={styles.accordionHeaderContent}>
            <Text allowFontScaling={false} style={styles.accordionHeaderText}>{title}</Text>
            {badge && <Text allowFontScaling={false} style={styles.accordionBadge}>{badge}</Text>}
          </View>
          <View style={styles.accordionHeaderActions}>
            {actionButton}
            <Text allowFontScaling={false} style={styles.accordionIcon}>{isOpen ? '▴' : '▾'}</Text>
          </View>
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.accordionContent}>
            {children}
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <AccordionSection id="settings" title="🎨 General Appearance">
        <GlobalSettingsPanel
          keyboardVariants={keyboardVariants}
          currentKeyboardId={currentKeyboardId}
          onKeyboardVariantChange={onKeyboardVariantChange}
        />
      </AccordionSection>

      <AccordionSection 
        id="styleRules" 
        title="☰ Keys Groups"
        badge={state.styleGroups.length > 0 ? `${state.styleGroups.length}` : undefined}
        actionButton={
          <View onStartShouldSetResponder={() => true}>
            <ActionButton
              label="New"
              color="green"
              icon="+"
              onPress={handleCreatePressed}
            />
          </View>
        }
      >
        <StyleRulesPanel 
          onEditPressed={handleEditPressed}
          onCreatePressed={handleCreatePressed}
        />
      </AccordionSection>

      {state.config.diacritics && (
        <AccordionSection id="diacritics" title="◌ָ  Nikkud (Diacritics)">
          <DiacriticsPanel />
        </AccordionSection>
      )}

      {/* Add/Edit Style Rule Modal */}
      <AddStyleRuleModal
        visible={showStyleRuleModal}
        editingGroup={editingGroup}
        initialSelectedKeys={editingGroup ? undefined : getSelectedKeyValues()}
        onClose={handleCloseModal}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  accordionSection: {
    marginBottom: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  accordionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accordionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  accordionBadge: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  accordionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accordionIcon: {
    fontSize: 60,
    color: '#6B7280',
  },
  accordionContent: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default Toolbox;