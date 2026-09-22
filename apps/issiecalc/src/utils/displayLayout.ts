/**
 * Splits the calculator's available height between the display and the keypad.
 *
 * The display renders a fixed number of text rows, and the height those rows
 * occupy has to be known *before* the split — otherwise the keypad takes its
 * share first and the rows are drawn outside the box, clipping the top one.
 * So the caller measures a "0" glyph at the live font weight and passes the
 * resulting `lineRatio`; everything here is derived from it.
 *
 * Priority, in order:
 *   1. The display gets the height its rows need at the preset's font size —
 *      taken from the keypad, which is why the ratio cap is only a cap.
 *   2. The keypad never drops below `minKbRatio` of the screen.
 *   3. Once that floor binds, the font shrinks to whatever still fits.
 */

export interface DisplayLayoutInput {
  /** Height left after top chrome and safe-area insets. */
  available: number;
  /** Font size the fontSizePreset asks for, before any clamping. */
  preferredFontSize: number;
  /** Rendered height of one line as a multiple of font size (measured). */
  lineRatio: number;
  /** Text rows the display shows: 2 in portrait, 1 in landscape. */
  displayRows: number;
  /** Non-text height inside the display: speak button, chip band, padding. */
  displayChrome: number;
  /** Gap below the expression row (styles.expression marginBottom). */
  expressionMargin: number;
  /** Rows in the active keyset, so the keypad snaps to a whole number of them. */
  keypadRowCount: number;
  /** Largest share of the screen the keypad may take. */
  ratioCap: number;
  /**
   * Smallest height one keypad row may be squeezed to, in points.
   *
   * Absolute rather than a share of the screen: what makes a keypad usable is
   * the size of a key under a fingertip, which does not change with the device.
   * A fractional floor binds far too early on a short screen — it pinned the
   * display to a fixed height, so every font preset above the smallest solved
   * back to the same size and the setting appeared to do nothing.
   */
  minKeypadRowHeight: number;
  /** The renderer's own bottom padding, outside the row grid. */
  keypadBottomPadding: number;
}

export interface DisplayLayout {
  /** Height to give the KeyboardPreview. */
  kbHeight: number;
  /** Height the display is left with (`available - kbHeight`). */
  displayHeight: number;
  /** Font size for the expression and result rows. */
  fontSize: number;
}

/** Smallest font we will shrink to before letting the text clip instead. */
const MIN_FONT_SIZE = 16;

/** Smallest fraction of the asked-for size a row will shrink to before clipping. */
export const MIN_WIDTH_SCALE = 0.3;

/**
 * Fraction of the available width left unused when fitting text to it.
 *
 * Scaling by exactly `available / naturalWidth` leaves no margin for the small
 * differences between the probe's layout and the rendered row's — inter-element
 * spacing, a trailing space, sub-pixel rounding in the text engine. Any of them
 * is enough to re-trigger the ellipsis the fit exists to avoid, so the fit aims
 * slightly under the real width.
 */
const WIDTH_SAFETY = 0.02;

/**
 * The largest font size at which text of `naturalWidth` (measured at
 * `fontSize`) fits within `available`.
 *
 * Text width scales linearly with font size, so a single measurement answers it
 * — no iteration. The measurement must come from an *unconstrained* layout: a
 * Text with numberOfLines={1} truncates to an ellipsis before reporting, so its
 * reported width always fits and would never trigger a shrink.
 *
 * Returns `fontSize` unchanged when there is nothing to act on (no measurement
 * yet, no known width, or the text already fits), so the first frame renders at
 * full size and settles once the probe reports.
 */
export function fitFontSize(
  fontSize: number,
  naturalWidth: number | undefined,
  available: number
): number {
  if (!naturalWidth || !available || naturalWidth <= available) return fontSize;
  const target = available * (1 - WIDTH_SAFETY);
  return Math.max(
    Math.ceil(fontSize * MIN_WIDTH_SCALE),
    Math.floor(fontSize * (target / naturalWidth))
  );
}

/** Height the text rows occupy at `fontSize`, excluding display chrome. */
function rowsHeight(fontSize: number, rows: number, lineRatio: number, margin: number): number {
  return Math.ceil(fontSize * lineRatio) * rows + margin * (rows - 1);
}

/**
 * Snaps a keypad height down to a whole number of rows plus the renderer's
 * bottom padding. The renderer divides the height it is given evenly across
 * its rows, so a fractional remainder would push the last row past the bottom
 * edge and clip it.
 */
function snapToRows(height: number, rowCount: number, bottomPadding: number): number {
  const rowHeight = Math.floor((height - bottomPadding) / rowCount);
  return Math.max(0, rowHeight) * rowCount + bottomPadding;
}

export function computeDisplayLayout(input: DisplayLayoutInput): DisplayLayout {
  const {
    available, preferredFontSize, lineRatio, displayRows, displayChrome,
    expressionMargin, keypadRowCount, ratioCap, minKeypadRowHeight, keypadBottomPadding,
  } = input;

  const wanted =
    rowsHeight(preferredFontSize, displayRows, lineRatio, expressionMargin) + displayChrome;

  // The keypad's cap keeps basic's keys square where there is room to spare;
  // its floor keeps each key big enough to hit where there is not.
  const kbCap = snapToRows(available * ratioCap, keypadRowCount, keypadBottomPadding);
  const kbWanted = minKeypadRowHeight * keypadRowCount + keypadBottomPadding;

  // What each side would take if it were alone. When both fit, the display gets
  // exactly what it asked for and the keypad takes the rest, bounded by the cap.
  const idealKb = Math.min(kbCap, available - wanted);

  // The display's irreducible minimum: its chrome plus rows at the smallest
  // legible font. If the keypad's comfortable height still leaves this much,
  // the keypad keeps it and the text shrinks to whatever remains.
  const displayFloor =
    rowsHeight(MIN_FONT_SIZE, displayRows, lineRatio, expressionMargin) + displayChrome;

  let kbHeight: number;
  if (idealKb >= kbWanted) {
    kbHeight = snapToRows(idealKb, keypadRowCount, keypadBottomPadding);
  } else if (kbWanted + displayFloor <= available) {
    // Both floors fit: honour the keypad's, and let the display take the rest.
    kbHeight = snapToRows(
      Math.min(kbCap, available - displayFloor, kbWanted),
      keypadRowCount,
      keypadBottomPadding
    );
  } else {
    // Too short even for a minimum display *and* a comfortable keypad. Neither
    // side may simply claim the space first: letting the keypad win starved the
    // display down to a font its own preset could no longer move, and letting
    // the display win leaves keys too small to hit. Split what there is in
    // proportion to the two floors, so both degrade together.
    kbHeight = snapToRows(
      (available * kbWanted) / (kbWanted + displayFloor),
      keypadRowCount,
      keypadBottomPadding
    );
  }
  kbHeight = Math.max(0, Math.min(kbHeight, available));

  const displayHeight = available - kbHeight;

  // Solve the font size back out of the height the display actually got, so
  // the rows provably fit rather than relying on the budget having been right.
  const textHeight = displayHeight - displayChrome;
  const perRow = (textHeight - expressionMargin * (displayRows - 1)) / displayRows;
  // The rendered row height is ceil(fontSize * lineRatio) — a whole point per
  // row — so a size chosen against the unrounded `perRow` overflows by up to
  // one point per row. Floor to the largest size whose *ceiled* row height
  // still fits, stepping down once when the rounding pushes it over.
  let fitted = Math.floor(perRow / lineRatio);
  if (Math.ceil(fitted * lineRatio) > Math.floor(perRow)) fitted -= 1;

  // MIN_FONT_SIZE is a floor on legibility, but fitting comes first: on a
  // screen so short that even minimum-size rows overflow, returning 16 would
  // break this function's one promise — that the rows it sizes fit the height
  // it returns. Clamp to 1 there instead, and let the caller's own minimum
  // (adjustsFontSizeToFit) decide what is readable.
  const fontSize = Math.max(1, Math.min(preferredFontSize, fitted));

  return { kbHeight, displayHeight, fontSize };
}
