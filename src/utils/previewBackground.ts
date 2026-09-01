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

/**
 * Background for everything above the keyboard on the IssieCalc main screen
 * (top bar + expression/result display).
 *
 * Defaults to the keyboard background, so a calculator that never sets it looks
 * exactly as it did before the setting existed.
 *
 * @param calcDisplayBgColor  calcDisplayBgColor from the config
 * @param keyboardBackground  the already-resolved keyboard background
 */
export function resolveCalcDisplayBackground(
  calcDisplayBgColor: string | null | undefined,
  keyboardBackground: string,
): string {
  return isDefaultBackground(calcDisplayBgColor)
    ? keyboardBackground
    : (calcDisplayBgColor as string);
}

/**
 * Text colour for the calc display: an explicit calcDisplayColor wins, otherwise
 * pick black or white for contrast against whatever is actually behind the text
 * (the display background, which may differ from the keyboard background).
 */
export function resolveCalcDisplayTextColor(
  calcDisplayColor: string | null | undefined,
  displayBackground: string,
): string {
  if (calcDisplayColor && !isDefaultBackground(calcDisplayColor)) {
    return calcDisplayColor;
  }
  const hex = displayBackground.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b > 0.5 ? '#000000' : '#FFFFFF';
  }
  return '#FFFFFF';
}
