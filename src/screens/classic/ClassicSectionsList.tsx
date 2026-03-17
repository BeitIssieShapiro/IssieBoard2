import React, { useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated, Switch, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import { ClassicState, DivisionMode } from './classicProfileBridge';

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
    const isSections = classicState.divisionMode === 'sections';
    const groupLabels = classicState.divisionMode === 'rows'
        ? ['Top Row', 'Middle Row', 'Bottom Row']
        : ['Right Third', 'Middle Third', 'Left Third'];

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
                <View style={styles.languageBar}>
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
                                {lang === 'he' ? 'Hebrew' : lang === 'en' ? 'English' : 'Arabic'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Main section */}
                <SectionHeader title="Main Settings" />
                <SettingRow icon="↻" title="Reset" onPress={() => onSelectSetting('reset')} />
                <SettingRow icon="ABC" title="Key Order" onPress={() => onSelectSetting('key-order')} />

                {/* Main Colors */}
                <SectionHeader title="Main Colors" />
                <ColorRow title="Background Color" color={backgroundColor} onPress={() => onSelectSetting('bg-color')} />
                <ColorRow title="Keys Color" color={keysBgColor} onPress={() => onSelectSetting('keys-color')} />
                <ColorRow title="Text Color" color={textColor} onPress={() => onSelectSetting('text-color')} />

                {/* Action Keys */}
                <SectionHeader title="Action Keys" />
                <ColorRow title="Space Key Color" color={classicState.actionGroups.space?.style.bgColor} onPress={() => onSelectSetting('space-color')} />
                <ColorRow title="Delete Key Color" color={classicState.actionGroups.delete?.style.bgColor} onPress={() => onSelectSetting('delete-color')} />
                <ColorRow title="Enter Key Color" color={classicState.actionGroups.enter?.style.bgColor} onPress={() => onSelectSetting('enter-color')} />
                <ColorRow title="Other Keys Color" color={classicState.actionGroups.other?.style.bgColor} onPress={() => onSelectSetting('other-color')} />

                {/* Nikkud - Hebrew only */}
                {currentLanguage === 'he' && (
                    <>
                        <SectionHeader title="Nikkud" />
                        <SettingRow title="Nikkud Settings" onPress={() => onSelectSetting('nikkud')} />
                    </>
                )}

                {/* Division Mode - inline toggle */}
                <SectionHeader title="Color Division" />
                <View style={styles.divisionToggle}>
                    <TouchableOpacity
                        style={[styles.divisionOption, classicState.divisionMode === 'rows' && styles.divisionOptionActive]}
                        onPress={() => onDivisionModeChange('rows')}
                    >
                        <Text
                            allowFontScaling={false}
                            style={[styles.divisionOptionText, classicState.divisionMode === 'rows' && styles.divisionOptionTextActive]}
                        >
                            By Rows
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
                            By Sections
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Per-group colors */}
                <SectionHeader title={`Group 1 (${groupLabels[0]})`} />
                <ColorRow title="Keys Color" color={classicState.charsetGroups[0]?.style.bgColor} onPress={() => onSelectSetting('group1-keys-color')} />
                <ColorRow title="Text Color" color={classicState.charsetGroups[0]?.style.color} onPress={() => onSelectSetting('group1-text-color')} />

                {isSections ? (
                    <>
                        <SectionHeaderWithSwitch
                            title={`Group 2 (${groupLabels[1]})`}
                            switchValue={classicState.threeColorMode}
                            onSwitchChange={onMiddleToggle}
                        />
                        <ColorRow
                            title="Keys Color"
                            color={classicState.charsetGroups[1]?.style.bgColor}
                            onPress={() => onSelectSetting('group2-keys-color')}
                            disabled={!classicState.threeColorMode}
                        />
                        <ColorRow
                            title="Text Color"
                            color={classicState.charsetGroups[1]?.style.color}
                            onPress={() => onSelectSetting('group2-text-color')}
                            disabled={!classicState.threeColorMode}
                        />
                    </>
                ) : (
                    <>
                        <SectionHeader title={`Group 2 (${groupLabels[1]})`} />
                        <ColorRow title="Keys Color" color={classicState.charsetGroups[1]?.style.bgColor} onPress={() => onSelectSetting('group2-keys-color')} />
                        <ColorRow title="Text Color" color={classicState.charsetGroups[1]?.style.color} onPress={() => onSelectSetting('group2-text-color')} />
                    </>
                )}

                <SectionHeader title={classicState.threeColorMode || !isSections ? `Group 3 (${groupLabels[2]})` : `Group 2 (${groupLabels[2]})`} />
                <ColorRow title="Keys Color" color={classicState.charsetGroups[2]?.style.bgColor} onPress={() => onSelectSetting('group3-keys-color')} />
                <ColorRow title="Text Color" color={classicState.charsetGroups[2]?.style.color} onPress={() => onSelectSetting('group3-text-color')} />

                {/* Special Keys */}
                <SectionHeader title="Special Keys" />
                <SettingRow title="Highlighted Characters" summary={classicState.specialKeysGroup?.members.join('') || 'None'} onPress={() => onSelectSetting('special-keys-text')} />
                <ColorRow title="Keys Color" color={classicState.specialKeysGroup?.style.bgColor} onPress={() => onSelectSetting('special-keys-color')} />
                <ColorRow title="Text Color" color={classicState.specialKeysGroup?.style.color} onPress={() => onSelectSetting('special-keys-text-color')} />

                {/* Visible Keys */}
                <SectionHeader title="Visible Keys" />
                <SettingRow title="Visible Keys" summary={classicState.visibleKeysGroup?.members.join('') || 'All'} onPress={() => onSelectSetting('visible-keys-text')} />

                {/* Load */}
                <View style={styles.saveRow}>
                    <TouchableOpacity style={styles.loadButton} onPress={() => onSelectSetting('my-issieboards')}>
                        <Text allowFontScaling={false} style={styles.loadButtonText}>My IssieBoards</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </Animated.View>
        </View>
    );
};

// Sub-components

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <View style={styles.sectionHeader}>
        <Text allowFontScaling={false} style={styles.sectionHeaderText}>{title}</Text>
    </View>
);

const SectionHeaderWithSwitch: React.FC<{
    title: string;
    switchValue: boolean;
    onSwitchChange: (value: boolean) => void;
}> = ({ title, switchValue, onSwitchChange }) => (
    <View style={[styles.sectionHeader, styles.sectionHeaderWithSwitch]}>
        <Text allowFontScaling={false} style={styles.sectionHeaderText}>{title}</Text>
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
}> = ({ icon, title, summary, onPress }) => (
    <TouchableOpacity style={styles.row} onPress={onPress}>
        {icon && <Text allowFontScaling={false} style={styles.rowIcon}>{icon}</Text>}
        <Text allowFontScaling={false} style={styles.rowTitle}>{title}</Text>
        {summary && <Text allowFontScaling={false} style={styles.rowSummary}>{summary}</Text>}
        <Text allowFontScaling={false} style={styles.rowChevron}>{'>'}</Text>
    </TouchableOpacity>
);

const ColorRow: React.FC<{
    title: string;
    color?: string;
    onPress: () => void;
    disabled?: boolean;
}> = ({ title, color, onPress, disabled }) => (
    <TouchableOpacity style={[styles.row, disabled && styles.rowDisabled]} onPress={onPress} disabled={disabled}>
        <View style={[styles.colorDot, { backgroundColor: color || '#CCC' }, disabled && { opacity: 0.4 }]} />
        <Text allowFontScaling={false} style={[styles.rowTitle, disabled && { color: '#C7C7CC' }]}>{title}</Text>
        {!disabled && <Text allowFontScaling={false} style={styles.rowChevron}>{'>'}</Text>}
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F2F2F7', overflow: 'hidden' },
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
