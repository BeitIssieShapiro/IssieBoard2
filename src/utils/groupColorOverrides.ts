/**
 * Detects when key groups mask the colors set on the General tab.
 *
 * Precedence (verified against ios/Shared/KeyboardModels.swift ParsedKey.init):
 *
 *   text color: key.color   -> groupTemplate.color   -> config.textColor
 *   key bg:     key.bgColor -> groupTemplate.bgColor -> config.keysBgColor
 *
 * Each color resolves independently and empty strings fall through, so a group
 * that only sets bgColor does NOT mask the General text color. Groups are keyed
 * by key value first, then key type (`groups[value] ?? groups[keyType]`), and a
 * later group replaces an earlier one for the same item (last wins).
 *
 * config.backgroundColor (the keyboard backdrop) is never overridable by groups.
 */

export type OverridableColor = 'keysBgColor' | 'textColor';

export interface GroupLike {
  name?: string;
  /** Key values or key types this group applies to. */
  members?: string[];
  items?: string[];
  style?: { bgColor?: string; color?: string };
  template?: { bgColor?: string; color?: string };
  active?: boolean;
}

export interface KeysetLike {
  id?: string;
  rows?: { keys?: { value?: string; type?: string; hidden?: boolean }[] }[];
}

export interface OverrideReport {
  /** Keys whose color comes from a group instead of the General tab. */
  maskedCount: number;
  /** Total keys in the inspected keyset. */
  totalCount: number;
  /** Names of the groups doing the masking, in config order, de-duplicated. */
  groupNames: string[];
  /** True when every key in the keyset is masked. */
  allMasked: boolean;
}

const members = (g: GroupLike): string[] => g.members ?? g.items ?? [];
const styleOf = (g: GroupLike) => g.style ?? g.template ?? {};

function colorFor(g: GroupLike, which: OverridableColor): string | undefined {
  const s = styleOf(g);
  const v = which === 'keysBgColor' ? s.bgColor : s.color;
  return v && v.trim() !== '' ? v : undefined;
}

/** Groups that are disabled (`active === false`) are saved but not applied. */
function activeGroups(groups: GroupLike[]): GroupLike[] {
  const active = groups.filter(g => g.active !== false);
  // Match InteractiveCanvas ordering: colorless showOnly groups are moved first so
  // that (last-wins) color groups are not overwritten by them.
  const isColorlessShowOnly = (g: GroupLike) => {
    const s = styleOf(g) as { visibilityMode?: string; bgColor?: string; color?: string };
    return s.visibilityMode === 'showOnly' && !s.bgColor && !s.color;
  };
  return [
    ...active.filter(isColorlessShowOnly),
    ...active.filter(g => !isColorlessShowOnly(g)),
  ];
}

/**
 * Resolve which group wins for each key item, mirroring buildGroupsMap:
 * later groups overwrite earlier ones for the same item.
 */
function buildWinnerMap(groups: GroupLike[]): Map<string, GroupLike> {
  const map = new Map<string, GroupLike>();
  for (const g of activeGroups(groups)) {
    for (const item of members(g)) map.set(item, g);
  }
  return map;
}

/**
 * Visible keys only. Layout spacers are declared as `hidden: true` keys with no
 * value or type (IssieCalc uses several per row), and groups also hide keys via
 * `visibilityMode: 'hide'`. Counting those would understate the warning — e.g.
 * calc's basic keyset reports 25 keys but 5 are invisible spacers, so "20 of 25"
 * really meant "all visible keys".
 */
function visibleKeysOf(
  keyset: KeysetLike | undefined,
  winners: Map<string, GroupLike>,
): { value: string; type: string }[] {
  if (!keyset?.rows) return [];
  const out: { value: string; type: string }[] = [];
  for (const row of keyset.rows) {
    for (const k of row.keys ?? []) {
      if (k.hidden) continue; // explicit spacer / hidden key
      const value = k.value ?? '';
      const type = k.type ?? '';
      if (!value && !type) continue; // structural placeholder with nothing to render
      const g = winners.get(value) ?? winners.get(type);
      const vis = (styleOf(g ?? {}) as { visibilityMode?: string }).visibilityMode;
      if (vis === 'hide') continue; // hidden by its group
      out.push({ value, type });
    }
  }
  return out;
}

/**
 * How many keys in `keyset` take `which` color from a group rather than from
 * the General tab setting.
 */
export function analyzeGroupOverrides(
  groups: GroupLike[] | undefined,
  keyset: KeysetLike | undefined,
  which: OverridableColor,
): OverrideReport {
  if (!groups?.length || !keyset) {
    return {
      maskedCount: 0,
      totalCount: visibleKeysOf(keyset, new Map()).length,
      groupNames: [],
      allMasked: false,
    };
  }

  const winners = buildWinnerMap(groups);
  const keys = visibleKeysOf(keyset, winners);

  let maskedCount = 0;
  const contributing = new Set<GroupLike>();

  for (const k of keys) {
    const g = winners.get(k.value) ?? winners.get(k.type);
    if (!g) continue;
    if (!colorFor(g, which)) continue; // group doesn't set THIS color -> falls through
    maskedCount++;
    contributing.add(g);
  }

  // Report names in config order (stable for display), not key-encounter order.
  const groupNames: string[] = [];
  const seen = new Set<string>();
  for (const g of activeGroups(groups)) {
    if (!contributing.has(g)) continue;
    const name = g.name?.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      groupNames.push(name);
    }
  }

  return {
    maskedCount,
    totalCount: keys.length,
    groupNames,
    allMasked: keys.length > 0 && maskedCount === keys.length,
  };
}
