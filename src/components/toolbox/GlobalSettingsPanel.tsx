import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { ColorPickerRow } from '../shared/ColorPickerRow';
import { ButtonGroupRow } from '../shared/ButtonGroupRow';
import { ToggleSwitch } from '../shared/ToggleSwitch';

export interface KeyboardVariantOption {
  id: string;
  name: string;
}

export interface FontOption {
  id: string;
  label: string;
  fontFamily?: string;
  fontSize?: number;
}

export interface GlobalSettingsPanelProps {
  /** Available keyboard variants for current language */
  keyboardVariants?: KeyboardVariantOption[];
  /** Currently selected keyboard variant */
  currentKeyboardId?: string;
  /** Callback when keyboard variant changes */
  onKeyboardVariantChange?: (keyboardId: string) => void;
  /** Advanced settings expanded state (controlled by parent) */
  advancedExpanded: boolean;
  /** Callback to toggle advanced settings */
  setAdvancedExpanded: (expanded: boolean) => void;
}

export const GlobalSettingsPanel: React.FC<GlobalSettingsPanelProps> = ({
  keyboardVariants,
  currentKeyboardId,
  onKeyboardVariantChange,
  advancedExpanded,
  setAdvancedExpanded,
}) => {
  const {
    state,
    updateBackgroundColor,
    updateWordSuggestions,
    updateAutoCorrect,
    updateFontName,
    updateFontSize,
    updateFontWeight,
    updateKeyGap,
    updateSettingsButton,
    dispatch,
  } = useEditor();

  // Get current settings (moved before local state initialization)
  const textColor = (state.config as any).textColor || '';
  const keysBgColor = (state.config as any).keysBgColor || '';
  const wordSuggestionsEnabled = state.config.wordSuggestionsEnabled !== false;
  const autoCorrectEnabled = state.config.autoCorrectEnabled === true;
  const currentFontName = state.config.fontName;
  const currentFontSize = state.config.fontSize;
  const currentFontWeight = state.config.fontWeight || 'heavy'; // Default to heavy
  const currentKeyHeight = state.config.keyHeight;
  const currentKeyGap = state.config.keyGap || 3;
  const settingsButtonEnabled = state.config.settingsButtonEnabled !== false;

  // Local state for advanced settings (before committing)
  const [localKeyHeight, setLocalKeyHeight] = useState<string>('');
  const [localFontSize, setLocalFontSize] = useState<string>('');

  // Debounce timers
  const keyHeightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fontSizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if we've initialized (to prevent resetting while user is typing)
  const initializedRef = useRef(false);

  // Initialize local state from config only once
  useEffect(() => {
    if (!initializedRef.current) {
      setLocalKeyHeight(currentKeyHeight?.toString() || '');
      setLocalFontSize(currentFontSize?.toString() || '');
      initializedRef.current = true;
    }
  }, [currentKeyHeight, currentFontSize]);

  // Check if current keyboard is Hebrew (matches 'he', 'he_ordered', etc.)
  const isHebrewKeyboard = currentKeyboardId?.startsWith('he') || false;

  // Font options for Hebrew keyboard
  const hebrewFontOptions: FontOption[] = [
    { id: 'system', label: 'אבג', fontFamily: undefined, fontSize: undefined },
    { id: 'yad', label: 'אבג', fontFamily: 'GveretLevinAlefAlefAlef-Regular', fontSize: 38 },
  ];

  // Key gap options
  const keyGapOptions = [
    { id: 'regular', label: 'Regular', value: 3 },
    { id: 'medium', label: 'Medium', value: 8 },
    { id: 'large', label: 'Large', value: 16 },
  ];

  // Font weight options
  const fontWeightOptions = [
    { id: 'light', label: 'Light', value: 'light' as const },
    { id: 'regular', label: 'Regular', value: 'regular' as const },
    { id: 'medium', label: 'Medium', value: 'medium' as const },
    { id: 'semibold', label: 'Semibold', value: 'semibold' as const },
    { id: 'bold', label: 'Bold', value: 'bold' as const },
    { id: 'heavy', label: 'Heavy', value: 'heavy' as const },
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

  const updateKeyHeight = (height: number | undefined) => {
    const updatedConfig = { ...state.config, keyHeight: height };
    dispatch({
      type: 'SET_CONFIG',
      payload: { config: updatedConfig, styleGroups: state.styleGroups },
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  // Debounced key height update
  const handleKeyHeightChange = (text: string) => {
    setLocalKeyHeight(text);

    // Clear existing timer
    if (keyHeightTimerRef.current) {
      clearTimeout(keyHeightTimerRef.current);
    }

    // Set new timer to commit after 1 second
    keyHeightTimerRef.current = setTimeout(() => {
      const num = parseInt(text, 10);
      if (text === '' || text === '0') {
        updateKeyHeight(undefined);
      } else if (!isNaN(num) && num >= 10 && num <= 180) {
        updateKeyHeight(num);
      }
    }, 1000);
  };

  // Debounced font size update
  const handleFontSizeChange = (text: string) => {
    setLocalFontSize(text);

    // Clear existing timer
    if (fontSizeTimerRef.current) {
      clearTimeout(fontSizeTimerRef.current);
    }

    // Set new timer to commit after 1 second
    fontSizeTimerRef.current = setTimeout(() => {
      const num = parseInt(text, 10);
      if (text === '' || text === '0') {
        updateFontSize(undefined);
      } else if (!isNaN(num) && num >= 10 && num <= 100) {
        updateFontSize(num);
      }
    }, 1000);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (keyHeightTimerRef.current) {
        clearTimeout(keyHeightTimerRef.current);
      }
      if (fontSizeTimerRef.current) {
        clearTimeout(fontSizeTimerRef.current);
      }
    };
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Keyboard Background Color */}
      <ColorPickerRow
        title="Keyboard Background"
        value={state.config.backgroundColor || ''}
        onChange={updateBackgroundColor}
        showSystemDefault
        systemDefaultLabel="Default"
      />

      {/* 2. Keys Background Color */}
      <ColorPickerRow
        title="Keys Background"
        value={keysBgColor}
        onChange={updateKeysBgColor}
        showSystemDefault
        systemDefaultLabel="Default"
      />

      {/* 3. Keys Text Color */}
      <ColorPickerRow
        title="Keys Text Color"
        value={textColor}
        onChange={updateTextColor}
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
            // Update fontSize if defined in the font option
            if (option?.fontSize !== undefined) {
              updateFontSize(option.fontSize);
            } else {
              // Clear fontSize to use default when switching to system font
              updateFontSize(undefined);
            }
          }}
        />
      )}

      {/* 5. Key Gap */}
      <ButtonGroupRow
        title="Gap Between Keys"
        options={keyGapOptions.map(opt => ({
          id: opt.id,
          label: opt.label,
        }))}
        selectedId={
          currentKeyGap === 3 ? 'regular' :
          currentKeyGap === 8 ? 'medium' :
          currentKeyGap === 16 ? 'large' :
          'regular'
        }
        onSelect={(id) => {
          const option = keyGapOptions.find(o => o.id === id);
          if (option) {
            updateKeyGap(option.value);
          }
        }}
      />

      {/* 6. Keyboard Layout (only show if multiple variants) */}
      {keyboardVariants && keyboardVariants.length > 1 && (
        <ButtonGroupRow
          title="Keyboard Layout"
          options={keyboardVariants.map(v => ({ id: v.id, label: v.name }))}
          selectedId={currentKeyboardId || ''}
          onSelect={onKeyboardVariantChange!}
        />
      )}

      {/* 7. Features */}
      <View style={styles.section}>
        <Text allowFontScaling={false} style={styles.settingTitle}>Features</Text>
        <View style={styles.featureRow}>
          <View style={styles.featureInfo}>
            <Text allowFontScaling={false} style={styles.featureLabel}>Word Suggestions</Text>
            <Text allowFontScaling={false} style={styles.featureDescription}>
              Show word completion suggestions above keyboard
            </Text>
          </View>
          <ToggleSwitch
            value={wordSuggestionsEnabled}
            onChange={updateWordSuggestions}
            labelOn=""
            labelOff=""
            size="medium"
          />
        </View>
        <View style={styles.featureRow}>
          <View style={styles.featureInfo}>
            <Text allowFontScaling={false} style={styles.featureLabel}>Auto-Correct</Text>
            <Text allowFontScaling={false} style={styles.featureDescription}>
              Replace typed word with suggestion when pressing space
            </Text>
          </View>
          <ToggleSwitch
            value={autoCorrectEnabled}
            onChange={updateAutoCorrect}
            labelOn=""
            labelOff=""
            size="medium"
            disabled={!wordSuggestionsEnabled}
          />
        </View>
        <View style={styles.featureRow}>
          <View style={styles.featureInfo}>
            <Text allowFontScaling={false} style={styles.featureLabel}>Settings Button</Text>
            <Text allowFontScaling={false} style={styles.featureDescription}>
              Show settings button on keyboard
            </Text>
          </View>
          <ToggleSwitch
            value={settingsButtonEnabled}
            onChange={updateSettingsButton}
            labelOn=""
            labelOff=""
            size="medium"
          />
        </View>
      </View>

      {/* 8. Advanced Settings (Expandable) */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.advancedHeader}
          onPress={() => setAdvancedExpanded(!advancedExpanded)}
          activeOpacity={0.7}
        >
          <Text allowFontScaling={false} style={styles.advancedTitle}>
            Advanced Settings
          </Text>
          <Text allowFontScaling={false} style={styles.advancedArrow}>
            {advancedExpanded ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>

        {advancedExpanded && (
          <View style={styles.advancedContent}>
            {/* Key Height */}
            <View style={styles.advancedRow}>
              <View style={styles.advancedInfo}>
                <Text allowFontScaling={false} style={styles.advancedLabel}>Key Height</Text>
                <Text allowFontScaling={false} style={styles.advancedDescription}>
                  Height of keys in points (10-180, default: auto)
                </Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={localKeyHeight}
                placeholder="Auto"
                placeholderTextColor="#999"
                keyboardType="numeric"
                onChangeText={handleKeyHeightChange}
              />
            </View>

            {/* Font Size */}
            <View style={styles.advancedRow}>
              <View style={styles.advancedInfo}>
                <Text allowFontScaling={false} style={styles.advancedLabel}>Font Size</Text>
                <Text allowFontScaling={false} style={styles.advancedDescription}>
                  Text size in points (10-100, default: auto)
                </Text>
              </View>
              <TextInput
                style={styles.numberInput}
                value={localFontSize}
                placeholder="Auto"
                placeholderTextColor="#999"
                keyboardType="numeric"
                onChangeText={handleFontSizeChange}
              />
            </View>

            {/* Font Weight */}
            <View style={styles.section}>
              <ButtonGroupRow
                title="Font Weight"
                options={fontWeightOptions.map(opt => ({
                  id: opt.id,
                  label: opt.label,
                }))}
                selectedId={fontWeightOptions.find(opt => opt.value === currentFontWeight)?.id || 'bold'}
                onSelect={(id) => {
                  const option = fontWeightOptions.find(o => o.id === id);
                  if (option) {
                    updateFontWeight(option.value);
                  }
                }}
              />
            </View>
          </View>
        )}
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
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E3F2FD',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  advancedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  advancedArrow: {
    fontSize: 12,
    color: '#1976D2',
  },
  advancedContent: {
    marginTop: -10,
    marginBottom: 10,
  },
  advancedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  advancedInfo: {
    flex: 1,
    marginRight: 12,
  },
  advancedLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  advancedDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  numberInput: {
    width: 80,
    height: 40,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    fontSize: 15,
    textAlign: 'center',
    color: '#333',
  },
});

export default GlobalSettingsPanel;