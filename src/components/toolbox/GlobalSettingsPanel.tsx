import React, { useState, useEffect, useMemo } from 'react';
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
import KeyboardPreferences from '../../native/KeyboardPreferences';
import { analyzeGroupOverrides, OverridableColor, OverrideReport } from '../../utils/groupColorOverrides';

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
  /** If set, show only this section: 'general' | 'features' | 'advanced' */
  section?: string;
  /** App context — hides settings button toggle for IssieVoice */
  appContext?: 'issievoice' | 'issieboard' | 'issiecalc';
  /** Callback when speak-button-in-keyboard setting changes (IssieVoice only) */
  onSpeakButtonInKeyboardChange?: (value: boolean) => void;
}

export const GlobalSettingsPanel: React.FC<GlobalSettingsPanelProps> = ({
  keyboardVariants,
  currentKeyboardId,
  onKeyboardVariantChange,
  advancedExpanded,
  setAdvancedExpanded,
  featuresExpanded,
  setFeaturesExpanded,
  section,
  appContext,
  onSpeakButtonInKeyboardChange,
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
  const { strings, isRTL } = useLocalization();

  // Speak button in keyboard setting (IssieVoice only)
  const [speakButtonInKeyboard, setSpeakButtonInKeyboard] = useState(false);
  // Symbols in suggestions setting (IssieVoice only, default off)
  const [symbolsInSuggestions, setSymbolsInSuggestions] = useState(false);
  useEffect(() => {
    if (appContext !== 'issievoice') return;
    const load = async () => {
      const speakVal = await KeyboardPreferences.getString('issievoice_speakButtonInKeyboard');
      setSpeakButtonInKeyboard(speakVal === 'true');
      const symbolsVal = await KeyboardPreferences.getString('issievoice_symbolsInSuggestions');
      setSymbolsInSuggestions(symbolsVal === 'true');
    };
    load();
  }, [appContext]);

  const handleSpeakButtonInKeyboardToggle = async (value: boolean) => {
    setSpeakButtonInKeyboard(value);
    await KeyboardPreferences.setString('issievoice_speakButtonInKeyboard', value ? 'true' : 'false');
    onSpeakButtonInKeyboardChange?.(value);
  };

  const handleSymbolsInSuggestionsToggle = async (value: boolean) => {
    setSymbolsInSuggestions(value);
    await KeyboardPreferences.setString('issievoice_symbolsInSuggestions', value ? 'true' : 'false');
  };

  // Get current settings (moved before local state initialization)
  const textColor = (state.config as any).textColor || '';
  const keysBgColor = (state.config as any).keysBgColor || '';
  const wordSuggestionsEnabled = state.config.wordSuggestionsEnabled !== false;
  const autoCorrectEnabled = state.config.autoCorrectEnabled === true;
  const currentFontName = state.config.fontName;
  const hasCustomFont = !!currentFontName;
  const currentFontSizePreset = state.config.fontSizePreset || 'normal';
  const currentHeightPreset = state.config.heightPreset || 'normal';
  const currentFontWeight = state.config.fontWeight || 'regular'; // Default to regular
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
    { id: 'large', label: strings.globalSettings.keyGapLarge, value: 10 },
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

  // Which groups mask the General-tab colors, for the keyset currently shown.
  // Mirrors InteractiveCanvas: styleGroups drives the preview, falling back to
  // config.groups only when there are no style rules at all (issiecalc case).
  const overrideReports = useMemo(() => {
    const groups = state.styleGroups.length > 0
      ? state.styleGroups
      : (state.config.groups || []);
    const keyset = state.config.keysets?.find(ks => ks.id === state.activeKeyset)
      ?? state.config.keysets?.[0];
    return {
      keysBgColor: analyzeGroupOverrides(groups as any, keyset as any, 'keysBgColor'),
      textColor: analyzeGroupOverrides(groups as any, keyset as any, 'textColor'),
    } as Record<OverridableColor, OverrideReport>;
  }, [state.styleGroups, state.config.groups, state.config.keysets, state.activeKeyset]);

  const warningTextFor = (report: OverrideReport): string | null => {
    if (report.maskedCount === 0) return null;
    const g = strings.globalSettings;
    return report.allMasked
      ? (g.groupOverrideAll || '').replace('{{total}}', String(report.totalCount))
      : (g.groupOverrideSome || '')
          .replace('{{masked}}', String(report.maskedCount))
          .replace('{{total}}', String(report.totalCount));
  };

  /**
   * Small ⚠ badge pinned to a swatch that is (partly) overridden by keys-groups.
   * Only "Keys Background" and "Keys Text" can ever be overridden — the keyboard
   * Background and the calc Display Text are never affected by groups.
   */
  const renderOverrideBadge = (which: OverridableColor) => {
    if (overrideReports[which].maskedCount === 0) return null;
    return (
      <View style={[styles.overrideBadge, isRTL ? styles.overrideBadgeRTL : styles.overrideBadgeLTR]}>
        <Text allowFontScaling={false} style={styles.overrideBadgeText}>⚠</Text>
      </View>
    );
  };

  /**
   * One warning under the colors row. Always names the affected control(s), so
   * it is clear which of the four swatches the message is about — and the two
   * can genuinely differ (a group that sets only bgColor leaves text color free).
   */
  const renderOverrideWarning = () => {
    const bg = warningTextFor(overrideReports.keysBgColor);
    const text = warningTextFor(overrideReports.textColor);
    if (!bg && !text) return null;

    const g = strings.globalSettings;
    const lines: string[] = bg && text && bg === text
      // Identical message for both -> combine the labels into one line.
      ? [`${g.keysBackground} + ${g.keysText}: ${bg}`]
      : ([
          bg ? `${g.keysBackground}: ${bg}` : null,
          text ? `${g.keysText}: ${text}` : null,
        ].filter(Boolean) as string[]);

    return (
      <View style={styles.overrideWarning}>
        {lines.map((line, i) => (
          <Text
            key={i}
            allowFontScaling={false}
            style={[
              styles.overrideWarningText,
              i > 0 && styles.overrideWarningTextSpaced,
              isRTL && { textAlign: 'right', writingDirection: 'rtl' },
            ]}
          >
            {'⚠ '}{line}
          </Text>
        ))}
      </View>
    );
  };

  const updateTextColor = (color: string) => {
    const updatedConfig = { ...state.config, textColor: color } as any;
    dispatch({
      type: 'SET_CONFIG',
      payload: { config: updatedConfig, styleGroups: state.styleGroups },
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  const calcDisplayColor = (state.config as any).calcDisplayColor || '';
  const updateCalcDisplayColor = (color: string) => {
    const updatedConfig = { ...state.config, calcDisplayColor: color } as any;
    dispatch({
      type: 'SET_CONFIG',
      payload: { config: updatedConfig, styleGroups: state.styleGroups },
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  const showScientific = (state.config as any).showScientific !== false;
  const calcMode: 'basic' | 'scientific' | 'both' = (() => {
    const v = (state.config as any).calcMode;
    if (v === 'basic' || v === 'scientific' || v === 'both') return v;
    // Migrate from old boolean showScientific
    return showScientific ? 'both' : 'basic';
  })();
  const updateCalcMode = (mode: 'basic' | 'scientific' | 'both') => {
    const updatedConfig = {
      ...state.config,
      calcMode: mode,
      showScientific: mode !== 'basic',
    } as any;
    dispatch({ type: 'SET_CONFIG', payload: { config: updatedConfig, styleGroups: state.styleGroups } });
    dispatch({ type: 'MARK_DIRTY' });
  };
  const updateShowScientific = (value: boolean) => {
    const updatedConfig = { ...state.config, showScientific: value } as any;
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
    const updatedConfig = { ...state.config, heightPreset: preset as 'compact' | 'normal' | 'tall' | 'x-tall', heightPreset_large: preset as 'compact' | 'normal' | 'tall' | 'x-tall' };
    dispatch({
      type: 'SET_CONFIG',
      payload: { config: updatedConfig, styleGroups: state.styleGroups },
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  const updateFontSizePreset = (preset: string) => {
    const updatedConfig = { ...state.config, fontSizePreset: preset as 'xs' | 'small' | 'normal' | 'large' | 'xl', fontSizePreset_large: preset as 'xs' | 'small' | 'normal' | 'large' | 'xl' };
    dispatch({
      type: 'SET_CONFIG',
      payload: { config: updatedConfig, styleGroups: state.styleGroups },
    });
    dispatch({ type: 'MARK_DIRTY' });
  };

  const showGeneral = !section || section === 'general' || section === 'general-and-advanced';
  const showFeatures = !section || section === 'features';
  const showAdvanced = !section || section === 'advanced' || section === 'general-and-advanced';

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, isRTL && { direction: 'rtl' }]}>
      {showGeneral && (
        <>
          {/* Colors Section */}
          <View style={styles.settingSection}>
            <Text allowFontScaling={false} style={styles.settingTitle}>{strings.globalSettings.colors}</Text>

            <View style={styles.colorsTable}>
              {/* Header Row */}
              <View style={[styles.colorsHeaderRow]}>
                <Text allowFontScaling={false} style={styles.colorColumnHeader}>{strings.globalSettings.background}</Text>
                <Text allowFontScaling={false} style={styles.colorColumnHeader}>{strings.globalSettings.keysBackground}</Text>
                <Text allowFontScaling={false} style={styles.colorColumnHeader}>{strings.globalSettings.keysText}</Text>
                {appContext === 'issiecalc' && (
                  <Text allowFontScaling={false} style={styles.colorColumnHeader}>{strings.globalSettings.calcDisplayColor}</Text>
                )}
              </View>

              {/* Color Buttons Row */}
              <View style={[styles.colorsButtonRow]}>
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
                  <View style={styles.colorPickerWrapper}>
                    <View style={overrideReports.keysBgColor.allMasked && styles.colorPickerMuted}>
                      <CompactColorPicker
                        title=""
                        value={keysBgColor}
                        onChange={updateKeysBgColor}
                        showSystemDefault
                        systemDefaultLabel={strings.common.default}
                      />
                    </View>
                    {renderOverrideBadge('keysBgColor')}
                  </View>
                </View>

                <View style={styles.colorColumn}>
                  <View style={styles.colorPickerWrapper}>
                    <View style={overrideReports.textColor.allMasked && styles.colorPickerMuted}>
                      <CompactColorPicker
                        title=""
                        value={textColor}
                        onChange={updateTextColor}
                        showSystemDefault
                        systemDefaultLabel={strings.common.default}
                      />
                    </View>
                    {renderOverrideBadge('textColor')}
                  </View>
                </View>

                {appContext === 'issiecalc' && (
                  <View style={styles.colorColumn}>
                    <CompactColorPicker
                      title=""
                      value={calcDisplayColor}
                      onChange={updateCalcDisplayColor}
                      showSystemDefault
                      systemDefaultLabel={strings.common.default}
                    />
                  </View>
                )}
              </View>

              {/* Warning that keys-groups override the colors set above */}
              {renderOverrideWarning()}
            </View>
          </View>

          {/* Calc mode selector (issiecalc only) */}
          {appContext === 'issiecalc' && (
            <View style={section ? styles.content : undefined}>
              <View style={styles.separator} />
              <View style={styles.section}>
                <ButtonGroupRow
                  title={strings.globalSettings.showScientific}
                  options={[
                    { id: 'basic', label: `÷≡  ${strings.globalSettings.calcBasic}` },
                    { id: 'scientific', label: `f(x)  ${strings.globalSettings.calcScientific}` },
                    { id: 'both', label: strings.globalSettings.calcModeBoth },
                  ]}
                  selectedId={calcMode}
                  onSelect={id => updateCalcMode(id as 'basic' | 'scientific' | 'both')}
                  isRTL={isRTL}
                />
              </View>
            </View>
          )}

          {/* 4. Font (only for Hebrew) */}
          {isHebrewKeyboard && (
            <>
              <View style={styles.separator} />
              <ButtonGroupRow
                isRTL={isRTL}
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
                  // Custom font only supports regular weight - always reset
                  if (option?.fontFamily) {
                    updateFontWeight('regular');
                  }
                }}
              />
            </>
          )}

        </>
      )}

      {/* 7. Features (Collapsible, or always-open in section mode) */}
      {showFeatures && (
        <View style={styles.section}>
          {!section && (
            <TouchableOpacity
              style={styles.advancedHeader}
              onPress={() => setFeaturesExpanded(!featuresExpanded)}
              activeOpacity={0.7}
            >
              <Text allowFontScaling={false} style={styles.advancedTitle}>
                {strings.globalSettings.features}
              </Text>
              <Text allowFontScaling={false} style={styles.advancedArrow}>
                {featuresExpanded ? '▼' : isRTL ? '◀' : '▶'}
              </Text>
            </TouchableOpacity>
          )}

          {(section || featuresExpanded) && (
            <View style={section ? styles.content : styles.advancedContent}>
              <View style={[styles.featureRow]}>
                <View style={[styles.featureInfo, isRTL && { marginRight: 0, marginLeft: 12 }]}>
                  <Text allowFontScaling={false} style={[styles.featureLabel,]}>{strings.globalSettings.wordSuggestions}</Text>
                  <Text allowFontScaling={false} style={[styles.featureDescription,]}>
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
              <View style={styles.separator} />
              <View style={styles.featureRow}>
                <View style={[styles.featureInfo, isRTL && { marginRight: 0, marginLeft: 12 }]}>
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
              {appContext !== 'issievoice' && (
                <>
                  <View style={styles.separator} />
                  <View style={styles.featureRow}>
                    <View style={[styles.featureInfo, isRTL && { marginRight: 0, marginLeft: 12 }]}>
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
                </>
              )}
              {appContext === 'issievoice' && (
                <>
                  <View style={styles.separator} />
                  <View style={styles.featureRow}>
                    <View style={[styles.featureInfo, isRTL && { marginRight: 0, marginLeft: 12 }]}>
                      <Text allowFontScaling={false} style={styles.featureLabel}>{strings.globalSettings.speakButtonInKeyboard}</Text>
                      <Text allowFontScaling={false} style={styles.featureDescription}>
                        {strings.globalSettings.speakButtonInKeyboardDesc}
                      </Text>
                    </View>
                    <ToggleSwitch
                      value={speakButtonInKeyboard}
                      onChange={handleSpeakButtonInKeyboardToggle}
                      labelOn=""
                      labelOff=""
                      size="medium"
                    />
                  </View>
                  <View style={styles.separator} />
                  <View style={styles.featureRow}>
                    <View style={[styles.featureInfo, isRTL && { marginRight: 0, marginLeft: 12 }]}>
                      <Text allowFontScaling={false} style={styles.featureLabel}>{strings.globalSettings.symbolsInSuggestions}</Text>
                      <Text allowFontScaling={false} style={styles.featureDescription}>
                        {strings.globalSettings.symbolsInSuggestionsDesc}
                      </Text>
                    </View>
                    <ToggleSwitch
                      value={symbolsInSuggestions}
                      onChange={handleSymbolsInSuggestionsToggle}
                      labelOn=""
                      labelOff=""
                      size="medium"
                    />
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      )}

      {/* 8. Advanced Settings (Expandable, or always-open in section mode) */}
      {showAdvanced && (
        <View style={styles.section}>
          {!section && (
            <TouchableOpacity
              style={styles.advancedHeader}
              onPress={() => setAdvancedExpanded(!advancedExpanded)}
              activeOpacity={0.7}
            >
              <Text allowFontScaling={false} style={styles.advancedTitle}>
                {strings.globalSettings.advancedSettings}
              </Text>
              <Text allowFontScaling={false} style={styles.advancedArrow}>
                {advancedExpanded ? '▼' : isRTL ? '◀' : '▶'}
              </Text>
            </TouchableOpacity>
          )}

          {(section || advancedExpanded) && (
            <View style={section ? styles.content : styles.advancedContent}>
              {/* Keyboard Layout (only show if multiple variants, not for IssieCalc) */}
              {appContext !== 'issiecalc' && keyboardVariants && keyboardVariants.length > 1 && (
                <>
                  <View style={styles.section}>
                    <ButtonGroupRow
                      isRTL={isRTL}
                      title={strings.globalSettings.keyboardLayout}
                      options={keyboardVariants.map(v => ({ id: v.id, label: v.name }))}
                      selectedId={currentKeyboardId || ''}
                      onSelect={onKeyboardVariantChange!}
                    />
                  </View>
                </>
              )}
              <View style={styles.separator} />


              {/* Key Gap */}
              <View style={styles.section}>
                <ButtonGroupRow
                  isRTL={isRTL}
                  title={strings.globalSettings.keyGap}
                  options={keyGapOptions.map(opt => ({
                    id: opt.id,
                    label: opt.label,
                  }))}
                  selectedId={
                    currentKeyGap === 3 ? 'regular' :
                      currentKeyGap === 8 ? 'medium' :
                        currentKeyGap === 10 ? 'large' :
                          'regular'
                  }
                  onSelect={(id) => {
                    const option = keyGapOptions.find(o => o.id === id);
                    if (option) {
                      updateKeyGap(option.value);
                    }
                  }}
                />
              </View>
              <View style={styles.separator} />


              {/* Height Preset */}
              <View style={styles.section}>
                <ButtonGroupRow
                  isRTL={isRTL}
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

              <View style={styles.separator} />

              {/* Font Size Preset */}
              <View style={styles.section}>
                <ButtonGroupRow
                  isRTL={isRTL}
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

              <View style={styles.separator} />

              {/* Font Weight */}
              <View style={styles.section}>
                <ButtonGroupRow
                  isRTL={isRTL}
                  title={strings.globalSettings.fontWeight}
                  options={fontWeightOptions.map(opt => ({
                    id: opt.id,
                    label: opt.label,
                    disabled: hasCustomFont && opt.id !== 'regular',
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
      )}
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
  // Shown when key groups override this color; the picker still works, it just
  // has no visible effect while every key is covered by a group.
  colorPickerMuted: {
    opacity: 0.45,
  },
  // Wrapper so the ⚠ badge can be absolutely positioned over the 50px swatch
  // without affecting layout (the swatches must stay aligned across columns).
  colorPickerWrapper: {
    position: 'relative',
  },
  overrideBadge: {
    position: 'absolute',
    top: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FDE047',
    borderWidth: 1,
    borderColor: '#CA8A04',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overrideBadgeLTR: {
    left: -4,
  },
  overrideBadgeRTL: {
    right: -4,
  },
  overrideBadgeText: {
    fontSize: 10,
    lineHeight: 13,
    color: '#713F12',
  },
  overrideWarning: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  overrideWarningText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#92400E',
  },
  overrideWarningTextSpaced: {
    marginTop: 4,
  },
  settingSection: {
    marginBottom: 16,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'left'
  },
  section: {
    marginBottom: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E0E0E0',
    marginVertical: 10,
    marginHorizontal: 4,
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
    textAlign: 'left'
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'left'
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
    fontWeight: 'semibold',
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