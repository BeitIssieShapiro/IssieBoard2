import React from 'react';
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
    updateAutoCorrect,
    updateFontName,
  } = useEditor();

  // Get current word suggestions setting (default to ON)
  const wordSuggestionsEnabled = state.config.wordSuggestionsEnabled !== false;
  
  // Get current auto-correct setting (default to OFF)
  const autoCorrectEnabled = state.config.autoCorrectEnabled === true;
  
  // Get current font name
  const currentFontName = state.config.fontName;
  
  // Check if current keyboard is Hebrew
  const isHebrewKeyboard = currentKeyboardId === 'he';
  
  // Font options for Hebrew keyboard
  const hebrewFontOptions = [
    { id: 'system', label: 'אבג', fontFamily: undefined },
    { id: 'yad', label: 'אבג', fontFamily: 'DanaYadAlefAlefAlef-Normal' },
  ];

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

      {/* Hebrew Font (only show for Hebrew keyboard) */}
      {isHebrewKeyboard && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Font</Text>
          <View style={styles.fontSelector}>
            {hebrewFontOptions.map(option => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.fontButton,
                  (option.fontFamily === currentFontName || (!option.fontFamily && !currentFontName)) && styles.fontButtonActive,
                ]}
                onPress={() => updateFontName(option.fontFamily)}
              >
                <Text style={[
                  styles.fontButtonText,
                  option.fontFamily && { fontFamily: option.fontFamily },
                  (option.fontFamily === currentFontName || (!option.fontFamily && !currentFontName)) && styles.fontButtonTextActive,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

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
  fontSelector: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
  },
  fontButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  fontButtonActive: {
    backgroundColor: '#2196F3',
  },
  fontButtonText: {
    fontSize: 28,
    color: '#666',
  },
  fontButtonYad: {
    fontFamily: 'DanaYadAlefAlefAlef-Normal',
  },
  fontButtonTextActive: {
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
});

export default GlobalSettingsPanel;