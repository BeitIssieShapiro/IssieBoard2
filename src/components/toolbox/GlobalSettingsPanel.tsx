import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useEditor } from '../../context/EditorContext';
import { useLocalization } from '../../localization';
import { CompactColorPicker } from '../shared/CompactColorPicker';
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
  /** Features expanded state (controlled by parent) */
  featuresExpanded: boolean;
  /** Callback to toggle features */
  setFeaturesExpanded: (expanded: boolean) => void;
}

export const GlobalSettingsPanel: React.FC<GlobalSettingsPanelProps> = ({
  keyboardVariants,
  currentKeyboardId,
  onKeyboardVariantChange,
  advancedExpanded,
  setAdvancedExpanded,
  featuresExpanded,
  setFeaturesExpanded,
}) => {
  const {
    state,
    updateBackgroundColor,
    updateWordSuggestions,
    updateAutoCorrect,
    updateFontName,
    updateFontWeight,
    updateKeyGap,
    updateSettingsButton,
    dispatch,
  } = useEditor();
  const { strings } = useLocalization();

  // Get current settings (moved before local state initialization)
  const textColor = (state.config as any).textColor || '';
  const keysBgColor = (state.config as any).keysBgColor || '';
  const wordSuggestionsEnabled = state.config.wordSuggestionsEnabled !== false;
  const autoCorrectEnabled = state.config.autoCorrectEnabled === true;
  const currentFontName = state.config.fontName;
  const currentFontSizePreset = state.config.fontSizePreset || 'normal';
  const currentHeightPreset = state.config.heightPreset || 'normal';
  const currentFontWeight = state.config.fontWeight || 'heavy'; // Default to heavy
  const currentKeyGap = state.config.keyGap || 3;
  const settingsButtonEnabled = state.config.settingsButtonEnabled !== false;

  // Font size presets
  const fontSizePresetOptions = [
    { id: 'xs', label: strings.globalSettings.sizeXS },
    { id: 'small', label: strings.globalSettings.sizeS },
    { id: 'normal', label: strings.globalSettings.sizeM },
    { id: 'large', label: strings.globalSettings.sizeL },
    { id: 'xl', label: strings.globalSettings.sizeXL },
  ];

  // Height presets
  const heightPresetOptions = [
    { id: 'compact', label: strings.globalSettings.heightCompact },
    { id: 'normal', label: strings.globalSettings.heightNormal },
    { id: 'tall', label: strings.globalSettings.heightTall },
    { id: 'x-tall', label: strings.globalSettings.heightXTall },
  ];

  // Check if current keyboard is Hebrew (matches 'he', 'he_ordered', etc.)
  const isHebrewKeyboard = currentKeyboardId?.startsWith('he') || false;

  // Font options for Hebrew keyboard
  const hebrewFontOptions: FontOption[] = [
    { id: 'system', label: 'אבג', fontFamily: undefined },
    { id: 'yad', label: 'אבג', fontFamily: 'GveretLevinAlefAlefAlef-Regular' },
  ];

  // Key gap options
  const keyGapOptions = [
    { id: 'regular', label: strings.globalSettings.keyGapRegular, value: 3 },
    { id: 'medium', label: strings.globalSettings.keyGapMedium, value: 8 },
    { id: 'large', label: strings.globalSettings.keyGapLarge, value: 16 },
  ];

  // Font weight options
  const fontWeightOptions = [
    { id: 'light', label: strings.globalSettings.weightLight, value: 'light' as const },
    { id: 'regular', label: strings.globalSettings.weightRegular, value: 'regular' as const },
    { id: 'medium', label: strings.globalSettings.weightMedium, value: 'medium' as const },
    { id: 'semibold', label: strings.globalSettings.weightSemibold, value: 'semibold' as const },
    { id: 'bold', label: strings.globalSettings.weightBold, value: 'bold' as const },
    { id: 'heavy', label: strings.globalSettings.weightHeavy, value: 'heavy' as const },
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

  const updateHeightPreset = (preset: string) => {
    const updatedConfig = { ...state.config, heightPreset: preset as 'compact' | 'normal' | 'tall' | 'x-tall' };
    dispatch({
      type: 'SET_CONFIG',
      payload: { config: updatedConfig, styleGroups: state.styleGroups },
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  const updateFontSizePreset = (preset: string) => {
    const updatedConfig = { ...state.config, fontSizePreset: preset as 'xs' | 'small' | 'normal' | 'large' | 'xl' };
    dispatch({
      type: 'SET_CONFIG',
      payload: { config: updatedConfig, styleGroups: state.styleGroups },
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Colors Section */}
      <View style={styles.settingSection}>
        <Text allowFontScaling={false} style={styles.settingTitle}>{strings.globalSettings.colors}</Text>

        <View style={styles.colorsTable}>
          {/* Header Row */}
          <View style={styles.colorsHeaderRow}>
            <Text allowFontScaling={false} style={styles.colorColumnHeader}>{strings.globalSettings.background}</Text>
            <Text allowFontScaling={false} style={styles.colorColumnHeader}>{strings.globalSettings.keysBackground}</Text>
            <Text allowFontScaling={false} style={styles.colorColumnHeader}>{strings.globalSettings.keysText}</Text>
          </View>

          {/* Color Buttons Row */}
          <View style={styles.colorsButtonRow}>
            <View style={styles.colorColumn}>
              <CompactColorPicker
                title=""
                value={state.config.backgroundColor || ''}
                onChange={updateBackgroundColor}
                showSystemDefault
                systemDefaultLabel={strings.common.default}
              />
            </View>

            <View style={styles.colorColumn}>
              <CompactColorPicker
                title=""
                value={keysBgColor}
                onChange={updateKeysBgColor}
                showSystemDefault
                systemDefaultLabel={strings.common.default}
              />
            </View>

            <View style={styles.colorColumn}>
              <CompactColorPicker
                title=""
                value={textColor}
                onChange={updateTextColor}
                showSystemDefault
                systemDefaultLabel={strings.common.default}
              />
            </View>
          </View>
        </View>
      </View>

      {/* 4. Font (only for Hebrew) */}
      {isHebrewKeyboard && (
        <ButtonGroupRow
          title={strings.globalSettings.font}
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

      {/* 5. Key Gap */}
      <ButtonGroupRow
        title={strings.globalSettings.keyGap}
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
          title={strings.globalSettings.keyboardLayout}
          options={keyboardVariants.map(v => ({ id: v.id, label: v.name }))}
          selectedId={currentKeyboardId || ''}
          onSelect={onKeyboardVariantChange!}
        />
      )}

      {/* 7. Features (Collapsible) */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.advancedHeader}
          onPress={() => setFeaturesExpanded(!featuresExpanded)}
          activeOpacity={0.7}
        >
          <Text allowFontScaling={false} style={styles.advancedTitle}>
            {strings.globalSettings.features}
          </Text>
          <Text allowFontScaling={false} style={styles.advancedArrow}>
            {featuresExpanded ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>

        {featuresExpanded && (
          <View style={styles.advancedContent}>
            <View style={styles.featureRow}>
              <View style={styles.featureInfo}>
                <Text allowFontScaling={false} style={styles.featureLabel}>{strings.globalSettings.wordSuggestions}</Text>
                <Text allowFontScaling={false} style={styles.featureDescription}>
                  {strings.globalSettings.wordSuggestionsDesc}
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
                <Text allowFontScaling={false} style={styles.featureLabel}>{strings.globalSettings.autoCorrect}</Text>
                <Text allowFontScaling={false} style={styles.featureDescription}>
                  {strings.globalSettings.autoCorrectDesc}
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
                <Text allowFontScaling={false} style={styles.featureLabel}>{strings.globalSettings.settingsButton}</Text>
                <Text allowFontScaling={false} style={styles.featureDescription}>
                  {strings.globalSettings.settingsButtonDesc}
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
        )}
      </View>

      {/* 8. Advanced Settings (Expandable) */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.advancedHeader}
          onPress={() => setAdvancedExpanded(!advancedExpanded)}
          activeOpacity={0.7}
        >
          <Text allowFontScaling={false} style={styles.advancedTitle}>
            {strings.globalSettings.advancedSettings}
          </Text>
          <Text allowFontScaling={false} style={styles.advancedArrow}>
            {advancedExpanded ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>

        {advancedExpanded && (
          <View style={styles.advancedContent}>
            {/* Height Preset */}
            <View style={styles.section}>
              <ButtonGroupRow
                title={strings.globalSettings.keyboardHeight}
                options={heightPresetOptions.map(opt => ({
                  id: opt.id,
                  label: opt.label,
                }))}
                selectedId={currentHeightPreset}
                onSelect={(id) => {
                  updateHeightPreset(id);
                }}
              />
            </View>

            {/* Font Size Preset */}
            <View style={styles.section}>
              <ButtonGroupRow
                title={strings.globalSettings.fontSize}
                options={fontSizePresetOptions.map(opt => ({
                  id: opt.id,
                  label: opt.label,
                }))}
                selectedId={currentFontSizePreset}
                onSelect={(id) => {
                  updateFontSizePreset(id);
                }}
              />
            </View>

            {/* Font Weight */}
            <View style={styles.section}>
              <ButtonGroupRow
                title={strings.globalSettings.fontWeight}
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
    padding: 16,
    paddingBottom: 0,
  },
  colorsTable: {
    marginBottom: 16,
  },
  colorsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  colorColumnHeader: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  colorsButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  colorColumn: {
    flex: 1,
    alignItems: 'center',
  },
  settingSection: {
    marginBottom: 16,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  section: {
    marginBottom: 0,
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
});

export default GlobalSettingsPanel;