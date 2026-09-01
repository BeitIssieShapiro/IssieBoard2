/**
 * Key groups carry a `groupType` saying what they are for: colours, visibility,
 * or both. The type is chosen when the group is created and persisted with it,
 * so the editor only offers the settings that belong to that type.
 *
 * Groups saved before types existed (and presets, which are authored as plain
 * style objects) have no `groupType`. For those the type is inferred from what
 * the group actually sets, and a group that sets both keeps showing both — no
 * existing group loses settings it already has.
 */

import { StyleGroup, StyleGroupType, KeyStyleOverride } from '../../types';

/** True when the style sets a colour. Empty strings count as unset. */
export function stylesColors(style: KeyStyleOverride | undefined): boolean {
  if (!style) return false;
  return !!(style.bgColor || style.color);
}

/**
 * True when the style affects visibility. The legacy `hidden` boolean counts:
 * it predates visibilityMode and is still read for backward compatibility.
 */
export function stylesVisibility(style: KeyStyleOverride | undefined): boolean {
  if (!style) return false;
  if (style.hidden) return true;
  return !!style.visibilityMode && style.visibilityMode !== 'default';
}

/**
 * The effective type of a group: its stored `groupType` when present, otherwise
 * inferred from the style.
 *
 * A group that sets neither (a new, empty one) is treated as 'colors' — the
 * common case, and it keeps the modal from opening with nothing to edit.
 */
export function getGroupType(group: Pick<StyleGroup, 'style' | 'groupType'>): StyleGroupType {
  if (group.groupType) return group.groupType;

  const colors = stylesColors(group.style);
  const visibility = stylesVisibility(group.style);

  if (colors && visibility) return 'both';
  if (visibility) return 'visibility';
  return 'colors';
}

/** Whether the colour controls apply to this type. */
export function showsColors(type: StyleGroupType): boolean {
  return type === 'colors' || type === 'both';
}

/** Whether the visibility controls apply to this type. */
export function showsVisibility(type: StyleGroupType): boolean {
  return type === 'visibility' || type === 'both';
}
