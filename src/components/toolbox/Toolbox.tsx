import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList } from 'react-native';
import { useEditor, getKeyValueFromPositionId } from '../../context/EditorContext';
import { useLocalization } from '../../localization';
import { GlobalSettingsPanel } from './GlobalSettingsPanel';
import { StyleRulesPanel } from './StyleRulesPanel';
import { DiacriticsPanel } from './DiacriticsPanel';
import { ActionButton } from '../shared/ActionButton';
import { AddStyleRuleModal } from './AddStyleRuleModal';
import { StyleGroup } from '../../../types';
import { MyIcon } from '@beitissieshapiro/issie-shared/dist/icons';

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
  orderedMembers?: string[];
  style: {
    hidden?: boolean;
    visibilityMode?: 'default' | 'hide' | 'showOnly';
    bgColor?: string;
    color?: string;
  };
}

/** Resolve the correct members array based on keyboardId (e.g., he_ordered uses orderedMembers) */
function resolveMembers(template: GroupTemplate, keyboardId?: string): string[] {
  if (keyboardId?.endsWith('_ordered') && template.orderedMembers) {
    return template.orderedMembers;
  }
  return template.members;
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
  /** If set, render only this section without accordion wrappers.
   *  'general' | 'keys-groups' | 'nikkud' | 'features' | 'advanced' */
  section?: string;
  /** App context — hides settings button toggle for IssieVoice */
  appContext?: 'issievoice' | 'issieboard';
  /** Callback when speak-button-in-keyboard setting changes (IssieVoice only) */
  onSpeakButtonInKeyboardChange?: (value: boolean) => void;
  /** Selected languages for IssieVoice language key injection */
  selectedLanguages?: string[];
  /** Whether speak button is shown in keyboard (IssieVoice only) */
  speakButtonInKeyboard?: boolean;
}

export const Toolbox: React.FC<ToolboxProps> = ({
  keyboardVariants,
  currentKeyboardId,
  onKeyboardVariantChange,
  profileName,
  section,
  appContext,
  onSpeakButtonInKeyboardChange,
  selectedLanguages,
  speakButtonInKeyboard,
}) => {
  const { state, clearSelection } = useEditor();
  const { strings, isRTL } = useLocalization();
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

  // Section-specific rendering (for headless per-tab mode)
  if (section) {
    const renderSectionContent = () => {
      switch (section) {
        case 'general':
          return (
            <GlobalSettingsPanel
              keyboardVariants={keyboardVariants}
              currentKeyboardId={currentKeyboardId}
              onKeyboardVariantChange={onKeyboardVariantChange}
              advancedExpanded={false}
              setAdvancedExpanded={() => {}}
              appContext={appContext}
              featuresExpanded={false}
              setFeaturesExpanded={() => {}}
              section="general"
            />
          );
        case 'keys-groups':
          return (
            <>
              <View style={[styles.keysGroupsActions, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity
                  style={styles.subtleButton}
                  onPress={() => setShowTemplatesModal(true)}
                  activeOpacity={0.7}>
                  <MyIcon info={{ name: 'list', type: 'Ionicons', color: '#3B82F6', size: 18 }} />
                  <Text allowFontScaling={false} style={styles.subtleButtonText}>{strings.toolbox.presets}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.subtleButton}
                  onPress={handleCreatePressed}
                  activeOpacity={0.7}>
                  <MyIcon info={{ name: 'add', type: 'Ionicons', color: '#3B82F6', size: 18 }} />
                  <Text allowFontScaling={false} style={styles.subtleButtonText}>{strings.toolbox.createNew}</Text>
                </TouchableOpacity>
              </View>
              <StyleRulesPanel
                onEditPressed={handleEditPressed}
                onCreatePressed={handleCreatePressed}
              />
            </>
          );
        case 'nikkud':
          return state.config.diacritics ? <DiacriticsPanel /> : null;
        case 'features':
          return (
            <GlobalSettingsPanel
              keyboardVariants={keyboardVariants}
              currentKeyboardId={currentKeyboardId}
              onKeyboardVariantChange={onKeyboardVariantChange}
              advancedExpanded={false}
              setAdvancedExpanded={() => {}}
              appContext={appContext}
              onSpeakButtonInKeyboardChange={onSpeakButtonInKeyboardChange}
              featuresExpanded={true}
              setFeaturesExpanded={() => {}}
              section="features"
            />
          );
        case 'advanced':
          return (
            <GlobalSettingsPanel
              keyboardVariants={keyboardVariants}
              currentKeyboardId={currentKeyboardId}
              onKeyboardVariantChange={onKeyboardVariantChange}
              advancedExpanded={true}
              setAdvancedExpanded={() => {}}
              appContext={appContext}
              featuresExpanded={false}
              setFeaturesExpanded={() => {}}
              section="advanced"
            />
          );
        default:
          return null;
      }
    };

    return (
      <ScrollView style={[styles.container, { backgroundColor: 'transparent' }]}>
        <View style={isRTL ? { direction: 'rtl' } : undefined}>
        {renderSectionContent()}
        </View>

        {/* Presets Browser Modal (needed for keys-groups) */}
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
                <Text allowFontScaling={false} style={styles.templatesTitle}>📋 {strings.toolbox.presetsModalTitle}</Text>
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
                        {resolveMembers(item, currentKeyboardId).length} {strings.toolbox.keysLabel}: {resolveMembers(item, currentKeyboardId).slice(0, 8).join(', ')}
                        {resolveMembers(item, currentKeyboardId).length > 8 ? '...' : ''}
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
          initialSelectedKeys={editingGroup ? undefined : (templateData ? resolveMembers(templateData, currentKeyboardId) : getSelectedKeyValues())}
          initialName={templateData?.name}
          initialBgColor={templateData?.style.bgColor}
          initialTextColor={templateData?.style.color}
          initialVisibilityMode={templateData?.style.visibilityMode}
          isPreset={!!(templateData && !editingGroup) || !!(editingGroup?.presetId)}
          presetId={templateData && !editingGroup ? templateData.id : editingGroup?.presetId}
          profileName={profileName}
          hideGlobeButton={appContext === 'issievoice'}
          hideCloseKey={appContext === 'issievoice'}
          selectedLanguages={selectedLanguages}
          speakButtonInKeyboard={speakButtonInKeyboard}
          onClose={handleCloseModal}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, isRTL && { direction: 'rtl' }]}>
      <AccordionSection id="settings" title={`🎨 ${strings.toolbox.generalAppearance}`}>
        <GlobalSettingsPanel
          keyboardVariants={keyboardVariants}
          currentKeyboardId={currentKeyboardId}
          onKeyboardVariantChange={onKeyboardVariantChange}
          advancedExpanded={advancedExpanded}
          setAdvancedExpanded={setAdvancedExpanded}
          featuresExpanded={featuresExpanded}
          setFeaturesExpanded={setFeaturesExpanded}
          appContext={appContext}
          onSpeakButtonInKeyboardChange={onSpeakButtonInKeyboardChange}
        />
      </AccordionSection>

      <AccordionSection 
        id="styleRules" 
        title={`☰ ${strings.toolbox.keysGroups}`}
        badge={state.styleGroups.length > 0 ? `${state.styleGroups.length}` : undefined}
        actionButton={
          <View onStartShouldSetResponder={() => true} style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.subtleButton}
              onPress={() => setShowTemplatesModal(true)}
              activeOpacity={0.7}>
              <MyIcon info={{ name: 'list', type: 'Ionicons', color: '#3B82F6', size: 18 }} />
              <Text allowFontScaling={false} style={styles.subtleButtonText}>{strings.toolbox.presets}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.subtleButton}
              onPress={handleCreatePressed}
              activeOpacity={0.7}>
              <MyIcon info={{ name: 'add', type: 'Ionicons', color: '#3B82F6', size: 18 }} />
              <Text allowFontScaling={false} style={styles.subtleButtonText}>{strings.toolbox.createNew}</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <StyleRulesPanel 
          onEditPressed={handleEditPressed}
          onCreatePressed={handleCreatePressed}
        />
      </AccordionSection>

      {state.config.diacritics && (
        <AccordionSection id="diacritics" title={`◌ָ  ${strings.toolbox.nikkud}`}>
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
              <Text allowFontScaling={false} style={styles.templatesTitle}>📋 {strings.toolbox.presetsModalTitle}</Text>
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
                      {resolveMembers(item, currentKeyboardId).length} {strings.toolbox.keysLabel}: {resolveMembers(item, currentKeyboardId).slice(0, 8).join(', ')}
                      {resolveMembers(item, currentKeyboardId).length > 8 ? '...' : ''}
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
        initialSelectedKeys={editingGroup ? undefined : (templateData ? resolveMembers(templateData, currentKeyboardId) : getSelectedKeyValues())}
        initialName={templateData?.name}
        initialBgColor={templateData?.style.bgColor}
        initialTextColor={templateData?.style.color}
        initialVisibilityMode={templateData?.style.visibilityMode}
        isPreset={!!(templateData && !editingGroup) || !!(editingGroup?.presetId)}
        presetId={templateData && !editingGroup ? templateData.id : editingGroup?.presetId}
        profileName={profileName}
        hideGlobeButton={appContext === 'issievoice'}
        hideCloseKey={appContext === 'issievoice'}
        selectedLanguages={selectedLanguages}
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
  keysGroupsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  subtleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  subtleButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
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