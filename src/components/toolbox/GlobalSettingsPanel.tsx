import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { ColorPickerRow } from '../shared/ColorPickerRow';
import { ButtonGroupRow } from '../shared/ButtonGroupRow';

// Text color presets
const TEXT_COLOR_PRESETS = [
  '#000000', '#FFFFFF', '#333333', '#666666',
  '#1976D2', '#388E3C', '#D32F2F', '#7B1FA2',
];

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
    updateAutoCorrect,
    updateFontName,
    updateSettingsButton,
    dispatch,
  } = useEditor();

  // Get current settings
  const textColor = (state.config as any).textColor || '';
  const keysBgColor = (state.config as any).keysBgColor || '';
  const wordSuggestionsEnabled = state.config.wordSuggestionsEnabled !== false;
  const autoCorrectEnabled = state.config.autoCorrectEnabled === true;
  const currentFontName = state.config.fontName;
  const settingsButtonEnabled = state.config.settingsButtonEnabled !== false;
  
  // Check if current keyboard is Hebrew
  const isHebrewKeyboard = currentKeyboardId === 'he';
  
  // Font options for Hebrew keyboard
  const hebrewFontOptions = [
    { id: 'system', label: 'אבג', fontFamily: undefined },
    { id: 'yad', label: 'אבג', fontFamily: 'GveretLevinAlefAlefAlef-Regular' },
  ];

  const updateTextColor = (color: string) => {
    const updatedConfig = { ...state.config, textColor: color } as any;
    dispatch({
      type: 'SET_CONFIG',
      payload: { config: updatedConfig, styleGroups: state.styleGroups },
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  const updateKeysBgColor = (color: string) => {
    const updatedConfig = { ...state.config, keysBgColor: color } as any;
    dispatch({
      type: 'SET_CONFIG',
      payload: { config: updatedConfig, styleGroups: state.styleGroups },
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Keyboard Background Color */}
      <ColorPickerRow
        title="Keyboard Background"
        value={state.config.backgroundColor || ''}
        onChange={updateBackgroundColor}
        presets={BACKGROUND_PRESETS}
        showSystemDefault
        systemDefaultLabel="Default"
      />

      {/* 2. Keys Background Color */}
      <ColorPickerRow
        title="Keys Background"
        value={keysBgColor}
        onChange={updateKeysBgColor}
        presets={BACKGROUND_PRESETS}
        showSystemDefault
        systemDefaultLabel="Default"
      />

      {/* 3. Keys Text Color */}
      <ColorPickerRow
        title="Keys Text Color"
        value={textColor}
        onChange={updateTextColor}
        presets={TEXT_COLOR_PRESETS}
        showSystemDefault
        systemDefaultLabel="Default"
      />

      {/* 4. Font (only for Hebrew) */}
      {isHebrewKeyboard && (
        <ButtonGroupRow
          title="Font"
          options={hebrewFontOptions.map(opt => ({
            id: opt.id,
            label: opt.label,
            customStyle: opt.fontFamily ? { fontFamily: opt.fontFamily } : undefined,
          }))}
          selectedId={currentFontName ? 'yad' : 'system'}
          onSelect={(id) => {
            const option = hebrewFontOptions.find(o => o.id === id);
            updateFontName(option?.fontFamily);
          }}
        />
      )}

      {/* 5. Keyboard Layout (only show if multiple variants) */}
      {keyboardVariants && keyboardVariants.length > 1 && (
        <ButtonGroupRow
          title="Keyboard Layout"
          options={keyboardVariants.map(v => ({ id: v.id, label: v.name }))}
          selectedId={currentKeyboardId || ''}
          onSelect={onKeyboardVariantChange!}
        />
      )}

      {/* 6. Features */}
      <View style={styles.section}>
        <Text style={styles.settingTitle}>Features</Text>
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
            trackColor={{ false: '#9E9E9E', true: '#81C784' }}
            thumbColor={wordSuggestionsEnabled ? '#4CAF50' : '#FFFFFF'}
          />
        </View>
        <View style={styles.featureRow}>
          <View style={styles.featureInfo}>
            <Text style={styles.featureLabel}>Auto-Correct</Text>
            <Text style={styles.featureDescription}>
              Replace typed word with suggestion when pressing space
            </Text>
          </View>
          <Switch
            value={autoCorrectEnabled}
            onValueChange={updateAutoCorrect}
            trackColor={{ false: '#9E9E9E', true: '#81C784' }}
            thumbColor={autoCorrectEnabled ? '#4CAF50' : '#FFFFFF'}
            disabled={!wordSuggestionsEnabled}
          />
        </View>
        <View style={styles.featureRow}>
          <View style={styles.featureInfo}>
            <Text style={styles.featureLabel}>Settings Button</Text>
            <Text style={styles.featureDescription}>
              Show settings button on keyboard
            </Text>
          </View>
          <Switch
            value={settingsButtonEnabled}
            onValueChange={updateSettingsButton}
            trackColor={{ false: '#9E9E9E', true: '#81C784' }}
            thumbColor={settingsButtonEnabled ? '#4CAF50' : '#FFFFFF'}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'transparent',
  },
  content: { 
    paddingBottom: 0,
  },
  section: { 
    marginBottom: 0,
  },
  settingTitle: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#333', 
    marginBottom: 12,
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
  featureInfo: { 
    flex: 1, 
    marginRight: 12,
  },
  featureLabel: { 
    fontSize: 15, 
    fontWeight: '500', 
    color: '#333',
  },
  featureDescription: { 
    fontSize: 12, 
    color: '#666', 
    marginTop: 4,
  },
});

export default GlobalSettingsPanel;