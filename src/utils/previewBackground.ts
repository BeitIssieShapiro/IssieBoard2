/**
 * Resolves the backdrop color shown behind the keyboard preview.
 *
 * A "default" (or empty/missing) backgroundColor makes the native keyboard
 * container transparent — the iOS "liquid glass" effect — so whatever the
 * keyboard is hosted on shows through. In the real app that's the host app's
 * background; in the editor preview there is no host, so the preview has to
 * stand in for it. Without this, choosing "default" in IssieCalc showed the
 * preview's own neutral grey while the actual app renders on black.
 */

/** Neutral backdrop used when no background is configured and no host is known. */
export const DEFAULT_PREVIEW_BACKGROUND = '#CBCFD8';

/** Fallback host background for IssieCalc if its config omits one. */
export const CALC_FALLBACK_BACKGROUND = '#1C1C1E';

export function isDefaultBackground(bg: string | null | undefined): boolean {
  return !bg || bg.trim() === '' || bg.trim().toLowerCase() === 'default';
}

/**
 * @param configBackground  backgroundColor from the keyboard config
 * @param appContext        which app is hosting the preview
 * @param calcHostBackground  IssieCalc's own background (from its default config)
 */
export function resolvePreviewBackground(
  configBackground: string | null | undefined,
  appContext: string | undefined,
  calcHostBackground?: string | null,
): string {
  if (!isDefaultBackground(configBackground)) {
    return configBackground as string;
  }

  if (appContext === 'issiecalc') {
    return isDefaultBackground(calcHostBackground)
      ? CALC_FALLBACK_BACKGROUND
      : (calcHostBackground as string);
  }

  return DEFAULT_PREVIEW_BACKGROUND;
}
