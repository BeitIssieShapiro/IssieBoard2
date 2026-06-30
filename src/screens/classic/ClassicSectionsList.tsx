import React, { useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated, Switch, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import { ClassicState, DivisionMode } from './classicProfileBridge';
import { useLocalization } from '../../localization';

export type SettingId =
    | 'language' | 'key-order' | 'reset'
    | 'bg-color' | 'keys-color' | 'text-color'
    | 'space-color' | 'delete-color' | 'enter-color' | 'other-color'
    | 'nikkud'
    | 'division-mode'
    | 'group1-keys-color' | 'group1-text-color'
    | 'group2-keys-color' | 'group2-text-color'
    | 'group3-keys-color' | 'group3-text-color'
    | 'special-keys-text' | 'special-keys-color' | 'special-keys-text-color'
    | 'visible-keys-text'
    | 'my-issieboards';

interface ClassicSectionsListProps {
    classicState: ClassicState;
    backgroundColor: string;
    keysBgColor: string;
    textColor: string;
    currentLanguage: string;
    onSelectSetting: (settingId: SettingId) => void;
    onLanguageChange: (lang: string) => void;
    onDivisionModeChange: (mode: DivisionMode) => void;
    onMiddleToggle: (enabled: boolean) => void;
}

const DECELERATION = 0.95;
const MIN_VELOCITY = 0.5;

const ClassicSectionsList: React.FC<ClassicSectionsListProps> = ({
    classicState,
    backgroundColor,
    keysBgColor,
    textColor,
    currentLanguage,
    onSelectSetting,
    onLanguageChange,
    onDivisionModeChange,
    onMiddleToggle,
}) => {
    const { strings, isRTL } = useLocalization();
    const isSections = classicState.divisionMode === 'sections';
    const groupLabels = classicState.divisionMode === 'rows'
        ? [strings.classic.topRow, strings.classic.middleRow, strings.classic.bottomRow]
        : [strings.classic.rightThird, strings.classic.middleThird, strings.classic.leftThird];

    const scrollY = useRef(new Animated.Value(0)).current;
    const offsetRef = useRef(0);
    const containerHeight = useRef(0);
    const contentHeight = useRef(0);
    const momentumRef = useRef<number | null>(null);

    const clamp = (val: number) => {
        const maxScroll = Math.max(0, contentHeight.current - containerHeight.current);
        return Math.min(maxScroll, Math.max(0, val));
    };

    const stopMomentum = () => {
        if (momentumRef.current !== null) {
            cancelAnimationFrame(momentumRef.current);
            momentumRef.current = null;
        }
    };

    const startMomentum = (velocity: number) => {
        stopMomentum();
        let v = velocity;
        const step = () => {
            v *= DECELERATION;
            if (Math.abs(v) < MIN_VELOCITY) return;
            const next = clamp(offsetRef.current - v);
            offsetRef.current = next;
            scrollY.setValue(-next);
            momentumRef.current = requestAnimationFrame(step);
        };
        momentumRef.current = requestAnimationFrame(step);
    };

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
        onPanResponderGrant: () => {
            stopMomentum();
        },
        onPanResponderMove: (_, gs) => {
            const next = clamp(offsetRef.current - gs.dy);
            scrollY.setValue(-next);
        },
        onPanResponderRelease: (_, gs) => {
            offsetRef.current = clamp(offsetRef.current - gs.dy);
            startMomentum(gs.vy * 16);
        },
    }), []);

    const onContainerLayout = (e: LayoutChangeEvent) => {
        containerHeight.current = e.nativeEvent.layout.height;
    };

    const onContentLayout = (e: LayoutChangeEvent) => {
        contentHeight.current = e.nativeEvent.layout.height;
    };

    return (
        <View style={styles.container} onLayout={onContainerLayout} {...panResponder.panHandlers}>
            <Animated.View
                style={{ transform: [{ translateY: scrollY }] }}
                onLayout={onContentLayout}
            >
                {/* Language selector */}
                <View style={[styles.languageBar, isRTL && { flexDirection: 'row-reverse' }]}>
                    {(['he', 'en', 'ar'] as const).map(lang => (
                        <TouchableOpacity
                            key={lang}
                            style={[styles.langButton, lang === currentLanguage && styles.langButtonActive]}
                            onPress={() => onLanguageChange(lang)}
                        >
                            <Text
                                allowFontScaling={false}
                                style={[styles.langText, lang === currentLanguage && styles.langTextActive]}
                            >
                                {lang === 'he' ? strings.editor.languages.hebrew : lang === 'en' ? strings.editor.languages.english : strings.editor.languages.arabic}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Main section */}
                <SectionHeader title={strings.classic.mainSettings} isRTL={isRTL} />
                <SettingRow icon="↻" title={strings.common.reset} onPress={() => onSelectSetting('reset')} isRTL={isRTL} />
                <SettingRow icon="ABC" title={strings.classic.keyOrder} onPress={() => onSelectSetting('key-order')} isRTL={isRTL} />

                {/* Main Colors */}
                <SectionHeader title={strings.classic.mainColors} isRTL={isRTL} />
                <ColorRow title={strings.classic.backgroundColor} color={backgroundColor} onPress={() => onSelectSetting('bg-color')} isRTL={isRTL} />
                <ColorRow title={strings.classic.keysColor} color={keysBgColor} onPress={() => onSelectSetting('keys-color')} isRTL={isRTL} />
                <ColorRow title={strings.classic.textColor} color={textColor} onPress={() => onSelectSetting('text-color')} isRTL={isRTL} />

                {/* Action Keys */}
                <SectionHeader title={strings.classic.actionKeys} isRTL={isRTL} />
                <ColorRow title={strings.classic.spaceKeyColor} color={classicState.actionGroups.space?.style.bgColor || keysBgColor} onPress={() => onSelectSetting('space-color')} isRTL={isRTL} />
                <ColorRow title={strings.classic.deleteKeyColor} color={classicState.actionGroups.delete?.style.bgColor || keysBgColor} onPress={() => onSelectSetting('delete-color')} isRTL={isRTL} />
                <ColorRow title={strings.classic.enterKeyColor} color={classicState.actionGroups.enter?.style.bgColor || keysBgColor} onPress={() => onSelectSetting('enter-color')} isRTL={isRTL} />
                <ColorRow title={strings.classic.otherKeysColor} color={classicState.actionGroups.other?.style.bgColor || keysBgColor} onPress={() => onSelectSetting('other-color')} isRTL={isRTL} />

                {/* Nikkud - Hebrew only */}
                {currentLanguage === 'he' && (
                    <>
                        <SectionHeader title={strings.classic.nikkud} isRTL={isRTL} />
                        <SettingRow title={strings.classic.nikkudSettings} onPress={() => onSelectSetting('nikkud')} isRTL={isRTL} />
                    </>
                )}

                {/* Division Mode - inline toggle */}
                <SectionHeader title={strings.classic.colorDivision} isRTL={isRTL} />
                <View style={[styles.divisionToggle, isRTL && { flexDirection: 'row-reverse' }]}>
                    <TouchableOpacity
                        style={[styles.divisionOption, classicState.divisionMode === 'rows' && styles.divisionOptionActive]}
                        onPress={() => onDivisionModeChange('rows')}
                    >
                        <Text
                            allowFontScaling={false}
                            style={[styles.divisionOptionText, classicState.divisionMode === 'rows' && styles.divisionOptionTextActive]}
                        >
                            {strings.classic.byRows}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.divisionOption, classicState.divisionMode === 'sections' && styles.divisionOptionActive]}
                        onPress={() => onDivisionModeChange('sections')}
                    >
                        <Text
                            allowFontScaling={false}
                            style={[styles.divisionOptionText, classicState.divisionMode === 'sections' && styles.divisionOptionTextActive]}
                        >
                            {strings.classic.bySections}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Per-group colors */}
                <SectionHeader title={`Group 1 (${groupLabels[0]})`} isRTL={isRTL} />
                <ColorRow title={strings.classic.keysColor} color={classicState.charsetGroups[0]?.style.bgColor || keysBgColor} onPress={() => onSelectSetting('group1-keys-color')} isRTL={isRTL} />
                <ColorRow title={strings.classic.textColor} color={classicState.charsetGroups[0]?.style.color || textColor} onPress={() => onSelectSetting('group1-text-color')} isRTL={isRTL} />

                {isSections ? (
                    <>
                        <SectionHeaderWithSwitch
                            title={`Group 2 (${groupLabels[1]})`}
                            switchValue={classicState.threeColorMode}
                            onSwitchChange={onMiddleToggle}
                            isRTL={isRTL}
                        />
                        <ColorRow
                            title={strings.classic.keysColor}
                            color={classicState.charsetGroups[1]?.style.bgColor || keysBgColor}
                            onPress={() => onSelectSetting('group2-keys-color')}
                            disabled={!classicState.threeColorMode}
                            isRTL={isRTL}
                        />
                        <ColorRow
                            title={strings.classic.textColor}
                            color={classicState.charsetGroups[1]?.style.color || textColor}
                            onPress={() => onSelectSetting('group2-text-color')}
                            disabled={!classicState.threeColorMode}
                            isRTL={isRTL}
                        />
                    </>
                ) : (
                    <>
                        <SectionHeader title={`Group 2 (${groupLabels[1]})`} isRTL={isRTL} />
                        <ColorRow title={strings.classic.keysColor} color={classicState.charsetGroups[1]?.style.bgColor || keysBgColor} onPress={() => onSelectSetting('group2-keys-color')} isRTL={isRTL} />
                        <ColorRow title={strings.classic.textColor} color={classicState.charsetGroups[1]?.style.color || textColor} onPress={() => onSelectSetting('group2-text-color')} isRTL={isRTL} />
                    </>
                )}

                <SectionHeader title={classicState.threeColorMode || !isSections ? `Group 3 (${groupLabels[2]})` : `Group 2 (${groupLabels[2]})`} isRTL={isRTL} />
                <ColorRow title={strings.classic.keysColor} color={classicState.charsetGroups[2]?.style.bgColor || keysBgColor} onPress={() => onSelectSetting('group3-keys-color')} isRTL={isRTL} />
                <ColorRow title={strings.classic.textColor} color={classicState.charsetGroups[2]?.style.color || textColor} onPress={() => onSelectSetting('group3-text-color')} isRTL={isRTL} />

                {/* Special Keys */}
                <SectionHeader title={strings.classic.specialKeys} isRTL={isRTL} />
                <SettingRow title={strings.classic.highlightedCharacters} summary={classicState.specialKeysGroup?.members.join('') || strings.common.none} onPress={() => onSelectSetting('special-keys-text')} isRTL={isRTL} />
                <ColorRow title={strings.classic.highlightKeysColor} color={classicState.specialKeysGroup?.style.bgColor} onPress={() => onSelectSetting('special-keys-color')} isRTL={isRTL} />
                <ColorRow title={strings.classic.highlightTextColor} color={classicState.specialKeysGroup?.style.color} onPress={() => onSelectSetting('special-keys-text-color')} isRTL={isRTL} />

                {/* Visible Keys */}
                <SectionHeader title={strings.classic.visibleKeys} isRTL={isRTL} />
                <SettingRow title={strings.classic.visibleKeys} summary={classicState.visibleKeysGroup?.members.join('') || 'All'} onPress={() => onSelectSetting('visible-keys-text')} isRTL={isRTL} />

                {/* Load */}
                <View style={styles.saveRow}>
                    <TouchableOpacity style={styles.loadButton} onPress={() => onSelectSetting('my-issieboards')}>
                        <Text allowFontScaling={false} style={styles.loadButtonText}>{strings.editor.myKeyboards}</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </Animated.View>
        </View>
    );
};

// Sub-components

const SectionHeader: React.FC<{ title: string; isRTL?: boolean }> = ({ title, isRTL }) => (
    <View style={styles.sectionHeader}>
        <Text allowFontScaling={false} style={[styles.sectionHeaderText, isRTL && { textAlign: 'right' }]}>{title}</Text>
    </View>
);

const SectionHeaderWithSwitch: React.FC<{
    title: string;
    switchValue: boolean;
    onSwitchChange: (value: boolean) => void;
    isRTL?: boolean;
}> = ({ title, switchValue, onSwitchChange, isRTL }) => (
    <View style={[styles.sectionHeader, styles.sectionHeaderWithSwitch, isRTL && { flexDirection: 'row-reverse' }]}>
        <Text allowFontScaling={false} style={[styles.sectionHeaderText, isRTL && { textAlign: 'right' }]}>{title}</Text>
        <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: '#E5E5EA', true: '#34C759' }}
        />
    </View>
);

const SettingRow: React.FC<{
    icon?: string;
    title: string;
    summary?: string;
    onPress: () => void;
    isRTL?: boolean;
}> = ({ icon, title, summary, onPress, isRTL }) => (
    <TouchableOpacity style={[styles.row, isRTL && { flexDirection: 'row-reverse' }]} onPress={onPress}>
        {icon && <Text allowFontScaling={false} style={[styles.rowIcon, isRTL && { marginRight: 0, marginLeft: 12 }]}>{icon}</Text>}
        <Text allowFontScaling={false} style={[styles.rowTitle, isRTL && { textAlign: 'right' }]}>{title}</Text>
        {summary && <Text allowFontScaling={false} style={[styles.rowSummary, isRTL && { marginLeft: 0, marginRight: 8 }]}>{summary}</Text>}
        <Text allowFontScaling={false} style={[styles.rowChevron, isRTL && { marginLeft: 0, marginRight: 8 }]}>{'>'}</Text>
    </TouchableOpacity>
);

const ColorRow: React.FC<{
    title: string;
    color?: string;
    onPress: () => void;
    disabled?: boolean;
    isRTL?: boolean;
}> = ({ title, color, onPress, disabled, isRTL }) => {
    const isDefault = !color;
    return (
        <TouchableOpacity style={[styles.row, disabled && styles.rowDisabled, isRTL && { flexDirection: 'row-reverse' }]} onPress={onPress} disabled={disabled}>
            {isDefault ? (
                <View style={[styles.colorDot, styles.colorDotDefault, disabled && { opacity: 0.4 }, isRTL && { marginRight: 0, marginLeft: 12 }]} />
            ) : (
                <View style={[styles.colorDot, { backgroundColor: color }, disabled && { opacity: 0.4 }, isRTL && { marginRight: 0, marginLeft: 12 }]} />
            )}
            <Text allowFontScaling={false} style={[styles.rowTitle, disabled && { color: '#C7C7CC' }, isRTL && { textAlign: 'right' }]}>{title}</Text>
            {!disabled && <Text allowFontScaling={false} style={[styles.rowChevron, isRTL && { marginLeft: 0, marginRight: 8 }]}>{'>'}</Text>}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5', overflow: 'hidden' },
    languageBar: { flexDirection: 'row', padding: 12, gap: 8 },
    langButton: { flex: 1, padding: 10, alignItems: 'center', backgroundColor: '#E5E5EA', borderRadius: 8 },
    langButtonActive: { backgroundColor: '#007AFF' },
    langText: { fontSize: 15, color: '#333' },
    langTextActive: { color: '#FFF', fontWeight: '600' },
    sectionHeader: { backgroundColor: '#E5E5EA', paddingHorizontal: 16, paddingVertical: 6 },
    sectionHeaderText: { fontSize: 13, color: '#6D6D72', textTransform: 'uppercase' },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#C6C6C8' },
    rowIcon: { fontSize: 16, marginRight: 12, width: 28, textAlign: 'center', color: '#666' },
    rowTitle: { flex: 1, fontSize: 17 },
    rowSummary: { fontSize: 15, color: '#8E8E93', marginLeft: 8 },
    rowChevron: { fontSize: 20, color: '#C7C7CC', marginLeft: 8 },
    colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#DDD', marginRight: 12 },
    colorDotDefault: { borderWidth: 2, borderColor: '#2196F3', borderStyle: 'dashed', backgroundColor: '#E3F2FD' },
    saveRow: { flexDirection: 'row', padding: 16, gap: 12 },
    loadButton: { flex: 1, borderWidth: 1, borderColor: '#007AFF', padding: 14, borderRadius: 10, alignItems: 'center' },
    loadButtonText: { color: '#007AFF', fontSize: 17 },
    divisionToggle: { flexDirection: 'row', backgroundColor: '#FFF', padding: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#C6C6C8' },
    divisionOption: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#E5E5EA', borderRadius: 8 },
    divisionOptionActive: { backgroundColor: '#007AFF' },
    divisionOptionText: { fontSize: 15, color: '#333', fontWeight: '500' },
    divisionOptionTextActive: { color: '#FFF', fontWeight: '600' },
    sectionHeaderWithSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowDisabled: { opacity: 0.5 },
});

export default ClassicSectionsList;
