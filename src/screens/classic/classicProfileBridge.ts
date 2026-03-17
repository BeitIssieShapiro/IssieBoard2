// classicProfileBridge.ts
// Maps classic UI concepts (charsets, division mode, action keys) to v2 style groups.
import { StyleGroup } from '../../../types';

// Known preset IDs for charset groups
const ROW_PRESETS = ['top-row', 'mid-row', 'bottom-row'];
const THIRD_PRESETS = ['left-third', 'mid-third', 'right-third'];
const HALF_PRESETS = ['left-half', 'right-half'];
const ACTION_PRESETS = ['space-key', 'delete-key', 'enter-key', 'other-keys'];

export type DivisionMode = 'rows' | 'sections';

export interface ClassicState {
    divisionMode: DivisionMode;
    threeColorMode: boolean;  // In sections mode: true = mid-third active, false = mid-third disabled. In rows mode: always true.
    charsetGroups: [StyleGroup | null, StyleGroup | null, StyleGroup | null];
    actionGroups: {
        space: StyleGroup | null;
        delete: StyleGroup | null;
        enter: StyleGroup | null;
        other: StyleGroup | null;
    };
    specialKeysGroup: StyleGroup | null;
    visibleKeysGroup: StyleGroup | null;
}

/**
 * Extract classic-UI-relevant state from v2 style groups.
 * Identifies charset groups, action groups, special keys, visible keys
 * from the full list of style groups.
 * Language is needed to map physical positions (left/right) to logical groups (1/2/3)
 * since RTL languages have group1 on the right side and LTR on the left.
 */
export function extractClassicState(styleGroups: StyleGroup[], language: string = 'he'): ClassicState {
    const rowGroups = findGroupsByIdPattern(styleGroups, ROW_PRESETS);
    const thirdGroups = findGroupsByIdPattern(styleGroups, THIRD_PRESETS);
    const halfGroups = findGroupsByIdPattern(styleGroups, HALF_PRESETS);

    // Determine division mode based on which groups exist and are active
    const hasActiveRows = rowGroups.some(g => g != null && g.active !== false);
    const hasActiveThirds = thirdGroups.some(g => g != null && g.active !== false);
    const hasActiveHalves = halfGroups.some(g => g != null && g.active !== false);
    const isSections = (hasActiveThirds || hasActiveHalves) && !hasActiveRows;
    const divisionMode: DivisionMode = isSections ? 'sections' : 'rows';

    const isLTR = language === 'en';

    let charsetGroups: [StyleGroup | null, StyleGroup | null, StyleGroup | null];
    let threeColorMode: boolean;

    if (divisionMode === 'sections') {
        if (hasActiveHalves && !hasActiveThirds) {
            // 2-group mode: halves active, thirds inactive
            // halfGroups[0] = left-half, halfGroups[1] = right-half
            // LTR: group1 = left-half, group3 = right-half
            // RTL: group1 = right-half, group3 = left-half
            charsetGroups = isLTR
                ? [halfGroups[0] ?? null, null, halfGroups[1] ?? null]
                : [halfGroups[1] ?? null, null, halfGroups[0] ?? null];
            threeColorMode = false;
        } else {
            // 3-group mode: thirds active
            // thirdGroups[0] = left-third, thirdGroups[1] = mid-third, thirdGroups[2] = right-third
            // LTR: group1 = left-third, group2 = mid-third, group3 = right-third
            // RTL: group1 = right-third, group2 = mid-third, group3 = left-third
            charsetGroups = isLTR
                ? [thirdGroups[0] ?? null, thirdGroups[1] ?? null, thirdGroups[2] ?? null]
                : [thirdGroups[2] ?? null, thirdGroups[1] ?? null, thirdGroups[0] ?? null];
            const midThird = thirdGroups[1];
            threeColorMode = midThird != null && midThird.active !== false;
        }
    } else {
        charsetGroups = [rowGroups[0] ?? null, rowGroups[1] ?? null, rowGroups[2] ?? null];
        threeColorMode = true;
    }

    // Find action key groups
    const space = findGroupByIdPattern(styleGroups, 'space-key');
    const del = findGroupByIdPattern(styleGroups, 'delete-key');
    const enter = findGroupByIdPattern(styleGroups, 'enter-key');
    const other = findGroupByIdPattern(styleGroups, 'other-keys');

    // Find special keys group (has a bgColor and visibilityMode is default, but not a known preset)
    const specialKeysGroup = styleGroups.find(g =>
        g.active !== false &&
        g.style.bgColor &&
        !isKnownPresetGroup(g) &&
        g.style.visibilityMode !== 'showOnly'
    ) ?? null;

    // Find visible keys group (has visibilityMode: 'showOnly')
    const visibleKeysGroup = styleGroups.find(g =>
        g.style.visibilityMode === 'showOnly'
    ) ?? null;

    return {
        divisionMode,
        threeColorMode,
        charsetGroups,
        actionGroups: { space, delete: del, enter, other },
        specialKeysGroup,
        visibleKeysGroup,
    };
}

export function matchesPreset(group: StyleGroup, presetId: string): boolean {
    return group.id.includes(presetId) || group.presetId === presetId;
}

function findGroupsByIdPattern(groups: StyleGroup[], presetIds: string[]): (StyleGroup | null)[] {
    return presetIds.map(presetId =>
        groups.find(g => matchesPreset(g, presetId)) ?? null
    );
}

function findGroupByIdPattern(groups: StyleGroup[], presetId: string): StyleGroup | null {
    return groups.find(g => matchesPreset(g, presetId)) ?? null;
}

function isKnownPresetGroup(group: StyleGroup): boolean {
    const knownPatterns = [...ROW_PRESETS, ...THIRD_PRESETS, ...HALF_PRESETS, ...ACTION_PRESETS, 'visible-keys'];
    return knownPatterns.some(pattern => matchesPreset(group, pattern));
}
