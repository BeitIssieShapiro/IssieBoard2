import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList } from 'react-native';
import { useEditor, getKeyValueFromPositionId } from '../../context/EditorContext';
import { GlobalSettingsPanel } from './GlobalSettingsPanel';
import { StyleRulesPanel } from './StyleRulesPanel';
import { DiacriticsPanel } from './DiacriticsPanel';
import { ActionButton } from '../shared/ActionButton';
import { AddStyleRuleModal } from './AddStyleRuleModal';
import { StyleGroup } from '../../../types';

// Import predefined rules
import heTemplates from '../../../assets/predefined-rules/he.json';
import enTemplates from '../../../assets/predefined-rules/en.json';
import arTemplates from '../../../assets/predefined-rules/ar.json';

// Template definitions for each language
interface GroupTemplate {
  id: string;
  name: string;
  description: string;
  members: string[];
  style: {
    hidden?: boolean;
    visibilityMode?: 'default' | 'hide' | 'showOnly';
    bgColor?: string;
    color?: string;
  };
}

const TEMPLATES: Record<string, GroupTemplate[]> = {
  he: heTemplates.rules,
  en: enTemplates.rules,
  ar: arTemplates.rules,
};

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
  /** Current profile name for breadcrumb display */
  profileName?: string;
}

export const Toolbox: React.FC<ToolboxProps> = ({
  keyboardVariants,
  currentKeyboardId,
  onKeyboardVariantChange,
  profileName,
}) => {
  const { state, clearSelection } = useEditor();
  const [showStyleRuleModal, setShowStyleRuleModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StyleGroup | null>(null);
  const [templateData, setTemplateData] = useState<GroupTemplate | null>(null);

  // All accordions open by default except diacritics
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    new Set(['settings', 'styleRules'])
  );

  // Advanced settings panel state (persists across re-renders)
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [featuresExpanded, setFeaturesExpanded] = useState(false);

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
    setTemplateData(null); // Clear template data
    clearSelection();
  }, [clearSelection]);

  const handleTemplateSelect = useCallback((template: GroupTemplate) => {
    // Close presets modal
    setShowTemplatesModal(false);

    // Store template data and open AddStyleRuleModal in CREATE mode with preset flag
    setTemplateData(template);
    setEditingGroup(null); // Ensure we're in create mode
    setShowStyleRuleModal(true);
  }, []);

  // Get templates for current language
  const getCurrentLanguage = (): string => {
    const keyboards = state.config.keyboards || [];
    if (keyboards.length > 0) {
      const firstKeyboard = keyboards[0];
      // Extract language from keyboard ID (e.g., "he" from "he_abc")
      return firstKeyboard.split('_')[0];
    }
    return 'en'; // fallback
  };

  const currentTemplates = TEMPLATES[getCurrentLanguage()] || TEMPLATES['en'];

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
          advancedExpanded={advancedExpanded}
          setAdvancedExpanded={setAdvancedExpanded}
          featuresExpanded={featuresExpanded}
          setFeaturesExpanded={setFeaturesExpanded}
        />
      </AccordionSection>

      <AccordionSection 
        id="styleRules" 
        title="☰ Keys Groups"
        badge={state.styleGroups.length > 0 ? `${state.styleGroups.length}` : undefined}
        actionButton={
          <View onStartShouldSetResponder={() => true} style={{ flexDirection: 'row', gap: 8 }}>
            <ActionButton
              label="Presets"
              color="blue"
              icon="📋"
              onPress={() => setShowTemplatesModal(true)}
            />
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

      {/* Presets Browser Modal */}
      <Modal
        visible={showTemplatesModal}
        transparent
        animationType="fade"
        supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setShowTemplatesModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTemplatesModal(false)}
        >
          <View style={styles.templatesModal} onStartShouldSetResponder={() => true}>
            <View style={styles.templatesHeader}>
              <Text allowFontScaling={false} style={styles.templatesTitle}>📋 Keys Group Presets</Text>
              <TouchableOpacity onPress={() => setShowTemplatesModal(false)}>
                <Text allowFontScaling={false} style={styles.templatesCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={currentTemplates}
              keyExtractor={(item, index) => `${item.name}_${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.templateItem}
                  onPress={() => handleTemplateSelect(item)}
                >
                  <View style={styles.templateInfo}>
                    <Text allowFontScaling={false} style={styles.templateName}>{item.name}</Text>
                    <Text allowFontScaling={false} style={styles.templateDescription}>{item.description}</Text>
                    <Text allowFontScaling={false} style={styles.templateKeys}>
                      {item.members.length} keys: {item.members.slice(0, 8).join(', ')}
                      {item.members.length > 8 ? '...' : ''}
                    </Text>
                  </View>
                  <Text allowFontScaling={false} style={styles.templateArrow}>›</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add/Edit Style Rule Modal */}
      <AddStyleRuleModal
        visible={showStyleRuleModal}
        editingGroup={editingGroup}
        initialSelectedKeys={editingGroup ? undefined : (templateData?.members || getSelectedKeyValues())}
        initialName={templateData?.name}
        initialBgColor={templateData?.style.bgColor}
        initialTextColor={templateData?.style.color}
        initialVisibilityMode={templateData?.style.visibilityMode}
        isPreset={!!templateData && !editingGroup} // Preset mode only when using template data and not editing
        profileName={profileName}
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
    paddingVertical: 0,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
  },
  accordionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accordionHeaderText: {
    fontSize: 19,
    fontWeight: '600',
    color: '#111827',
  },
  accordionBadge: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
  },
  accordionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 25,
  },
  accordionIcon: {
    fontSize: 60,
    color: '#6B7280',
  },
  accordionContent: {
    padding: 6,
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
  // Templates Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  templatesModal: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '90%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  templatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  templatesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  templatesCloseButton: {
    fontSize: 24,
    color: '#666',
    fontWeight: 'bold',
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  templateKeys: {
    fontSize: 12,
    color: '#999',
  },
  templateArrow: {
    fontSize: 24,
    color: '#3B82F6',
    marginLeft: 12,
  },
});

export default Toolbox;