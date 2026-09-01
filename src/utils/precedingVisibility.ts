/**
 * Resolves which keys are hidden by a run of visibility groups.
 *
 * Used by the add/edit group modal: the preview there must show the effect of
 * the groups that come *before* the one being edited, or a new group appears to
 * ignore an earlier "show only" rule and shows the whole keyboard.
 *
 * Groups are applied in list order and the last one to touch a key wins, which
 * is how the native renderer resolves overlapping groups. The caller renders the
 * result as dimming rather than true hiding, so every key stays tappable and can
 * still be selected for the group being edited.
 */

import { VisibilityMode } from '../../types';

export interface VisibilityGroupLike {
  members: string[];
  style?: { visibilityMode?: VisibilityMode; hidden?: boolean };
}

/** The group's effective mode, honouring the legacy `hidden` boolean. */
export function visibilityModeOf(group: VisibilityGroupLike): VisibilityMode {
  const mode = group.style?.visibilityMode;
  if (mode) return mode;
  return group.style?.hidden ? 'hide' : 'default';
}

/**
 * @param groups     the preceding groups, in list order (already filtered to active ones)
 * @param allValues  every key a visibility rule may affect (essential keys excluded)
 * @returns the key values that end up hidden
 */
export function resolveHiddenKeys(
  groups: VisibilityGroupLike[],
  allValues: Iterable<string>,
): Set<string> {
  const hidden = new Map<string, boolean>();

  for (const group of groups) {
    const mode = visibilityModeOf(group);
    if (mode === 'hide') {
      for (const member of group.members) hidden.set(member, true);
    } else if (mode === 'showOnly') {
      // Shows its members and hides everything else.
      const shown = new Set(group.members);
      for (const value of allValues) hidden.set(value, !shown.has(value));
    }
    // 'default' groups affect only colours, never visibility.
  }

  return new Set(
    [...hidden.entries()].filter(([, isHidden]) => isHidden).map(([value]) => value),
  );
}
