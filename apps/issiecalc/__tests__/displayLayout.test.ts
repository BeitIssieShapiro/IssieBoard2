import {
  computeDisplayLayout,
  fitFontSize,
  MIN_WIDTH_SCALE,
  DisplayLayoutInput,
} from '../src/utils/displayLayout';

/**
 * The display's job: whatever the preset asks for, the rows it renders must fit
 * in the height it ends up with. These tests pin that invariant across the
 * shapes the real screen takes — every font preset, both orientations, a range
 * of device heights — because the bug this module exists to fix only shows up
 * at the combinations where the budget and the render disagreed.
 */

// Font sizes the presets ask for: 48 * {xs 2.0 ... xl 3.6} (see CalcScreen).
const PRESET_FONT_SIZES = [96, 115, 130, 149, 173];
// Plausible `available` values: short phone landscape through tall tablet.
const AVAILABLE_HEIGHTS = [300, 420, 560, 700, 840, 1000];
// Measured "0" ratios: iOS system font sits near 1.2, but a heavy weight or an
// unusual font can run taller, and the fallback before measurement is 1.25.
const LINE_RATIOS = [1.19, 1.25, 1.4];

const base: DisplayLayoutInput = {
  available: 700,
  preferredFontSize: 130,
  lineRatio: 1.25,
  displayRows: 2,
  displayChrome: 16,
  expressionMargin: 8,
  keypadRowCount: 5,
  ratioCap: 0.64,
  minKeypadRowHeight: 56,
  keypadBottomPadding: 4,
};

/** The height the rendered rows actually occupy at a given font size. */
function renderedRowsHeight(fontSize: number, input: DisplayLayoutInput): number {
  return (
    Math.ceil(fontSize * input.lineRatio) * input.displayRows +
    input.expressionMargin * (input.displayRows - 1)
  );
}

/** Every combination the real screen can present. */
function allCases(): DisplayLayoutInput[] {
  const cases: DisplayLayoutInput[] = [];
  for (const available of AVAILABLE_HEIGHTS) {
    for (const preferredFontSize of PRESET_FONT_SIZES) {
      for (const lineRatio of LINE_RATIOS) {
        for (const displayRows of [1, 2]) {
          for (const { ratioCap, keypadRowCount } of [
            { ratioCap: 0.64, keypadRowCount: 5 }, // basic
            { ratioCap: 0.76, keypadRowCount: 6 }, // scientific
            { ratioCap: 0.78, keypadRowCount: 5 }, // landscape
          ]) {
            cases.push({
              ...base,
              available,
              preferredFontSize,
              lineRatio,
              displayRows,
              ratioCap,
              keypadRowCount,
            });
          }
        }
      }
    }
  }
  return cases;
}

describe('computeDisplayLayout', () => {
  it('sizes the text so its rows fit the display height it returns', () => {
    for (const input of allCases()) {
      const { fontSize, displayHeight } = computeDisplayLayout(input);
      const needed = renderedRowsHeight(fontSize, input) + input.displayChrome;
      if (needed > displayHeight) {
        throw new Error(
          `rows overflow: needed ${needed} > displayHeight ${displayHeight} ` +
            `(available ${input.available}, preferred ${input.preferredFontSize}, ` +
            `ratio ${input.lineRatio}, rows ${input.displayRows}, cap ${input.ratioCap})`
        );
      }
    }
  });

  it('never returns a font size larger than the preset asks for', () => {
    for (const input of allCases()) {
      const { fontSize } = computeDisplayLayout(input);
      expect(fontSize).toBeLessThanOrEqual(input.preferredFontSize);
    }
  });

  it('keeps every keypad row at its minimum height whenever the display fits too', () => {
    for (const input of allCases()) {
      const { kbHeight } = computeDisplayLayout(input);
      const rowHeight = (kbHeight - input.keypadBottomPadding) / input.keypadRowCount;
      if (rowHeight >= input.minKeypadRowHeight) continue;
      const displayFloor =
        Math.ceil(16 * input.lineRatio) * input.displayRows +
        input.expressionMargin * (input.displayRows - 1) +
        input.displayChrome;
      const keypadFloor =
        input.minKeypadRowHeight * input.keypadRowCount + input.keypadBottomPadding;
      // The floor may only be breached for one of two honest reasons: the
      // screen is too short to honour it alongside a legible display, or the
      // ratio cap itself is below it (a keyset with many rows on a short
      // screen), in which case square keys were never achievable either.
      const tooShort = displayFloor + keypadFloor > input.available;
      const capBelowFloor = input.available * input.ratioCap < keypadFloor;
      expect(tooShort || capBelowFloor).toBe(true);
    }
  });

  it('gives the keypad less than its comfortable height only when the display needs it', () => {
    // A roomy screen must never shortchange the keypad: if the display got
    // everything it asked for, the keypad keeps at least its minimum rows.
    const { kbHeight } = computeDisplayLayout({
      ...base, available: 1000, preferredFontSize: 96, lineRatio: 1.2,
    });
    const rowHeight = (kbHeight - base.keypadBottomPadding) / base.keypadRowCount;
    expect(rowHeight).toBeGreaterThanOrEqual(base.minKeypadRowHeight);
  });

  it('never lets the keypad exceed its ratio cap, unless the row floor forces it', () => {
    for (const input of allCases()) {
      const { kbHeight } = computeDisplayLayout(input);
      const floor = input.minKeypadRowHeight * input.keypadRowCount + input.keypadBottomPadding;
      expect(kbHeight).toBeLessThanOrEqual(
        Math.max(floor, Math.ceil(input.available * input.ratioCap))
      );
    }
  });

  it('gives a larger font preset a larger font, wherever there is room to grow', () => {
    // The regression this pins: a floor expressed as a share of the screen
    // bound so early that every preset above the smallest solved back to the
    // same font size, and the setting appeared to do nothing.
    // Only where the keypad still has slack above its floor can the display
    // grow, so only there can the presets differ. Below ~700pt of two-row
    // space the keypad is already pinned at its minimum rows and every preset
    // honestly resolves to the same size; that is a real constraint, not a
    // regression. Every real two-row device (phone portrait from the 15 up,
    // tablets either way) is at or above this.
    for (const available of AVAILABLE_HEIGHTS.filter(h => h >= 700)) {
      for (const { ratioCap, keypadRowCount } of [
        { ratioCap: 0.64, keypadRowCount: 5 },
        { ratioCap: 0.78, keypadRowCount: 5 },
      ]) {
        const sizes = PRESET_FONT_SIZES.map(
          preferredFontSize =>
            computeDisplayLayout({
              ...base, available, preferredFontSize, lineRatio: 1.2,
              displayRows: 2, ratioCap, keypadRowCount,
            }).fontSize
        );
        // Monotonic: a bigger ask never yields a smaller result.
        for (let i = 1; i < sizes.length; i++) {
          expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
        }
        // And not every preset collapses to one value — the smallest and
        // largest must differ, or the setting is inert on this screen.
        expect(sizes[sizes.length - 1]).toBeGreaterThan(sizes[0]);
      }
    }
  });

  it('gives the keypad a whole number of rows plus its bottom padding', () => {
    for (const input of allCases()) {
      const { kbHeight } = computeDisplayLayout(input);
      expect((kbHeight - input.keypadBottomPadding) % input.keypadRowCount).toBe(0);
    }
  });

  it('splits the available height exactly between keypad and display', () => {
    for (const input of allCases()) {
      const { kbHeight, displayHeight } = computeDisplayLayout(input);
      expect(kbHeight + displayHeight).toBe(input.available);
    }
  });

  it('takes height from the keypad so a large preset renders at full size', () => {
    // A tall screen has room for xl if the keypad gives up its ratio cap.
    const { fontSize, kbHeight } = computeDisplayLayout({
      ...base,
      available: 1000,
      preferredFontSize: 173,
      lineRatio: 1.2,
    });
    expect(fontSize).toBe(173);
    expect(kbHeight).toBeLessThan(1000 * base.ratioCap);
  });

  it('shares the shortfall between text and keypad on a screen too short for both', () => {
    // A short screen cannot fit xl *and* a comfortable keypad. Neither side may
    // take the whole loss: the text shrinks below the preset, and the keypad
    // drops below its comfortable rows, rather than one collapsing entirely.
    // 300pt cannot hold a 284pt comfortable keypad and a legible display.
    const input = { ...base, available: 300, preferredFontSize: 173, lineRatio: 1.2 };
    const { fontSize, kbHeight, displayHeight } = computeDisplayLayout(input);
    expect(fontSize).toBeLessThan(173);
    const rowHeight = (kbHeight - input.keypadBottomPadding) / input.keypadRowCount;
    expect(rowHeight).toBeLessThan(input.minKeypadRowHeight);
    // Both sides still get a real share — neither is squeezed to nothing.
    expect(displayHeight).toBeGreaterThan(input.displayChrome);
    expect(kbHeight).toBeGreaterThan(input.available * 0.3);
  });

  it('stays at or above the legible minimum on any screen that can hold it', () => {
    for (const input of allCases()) {
      const { fontSize, displayHeight } = computeDisplayLayout(input);
      if (fontSize >= 16) continue;
      // Dropping below 16 is only allowed when 16 would not have fit: fitting
      // the rows is the one guarantee this function makes, so it outranks the
      // legibility floor in the corner where the two conflict.
      const needAtMin =
        Math.ceil(16 * input.lineRatio) * input.displayRows +
        input.expressionMargin * (input.displayRows - 1) +
        input.displayChrome;
      expect(needAtMin).toBeGreaterThan(displayHeight);
    }
  });

  it('fits two rows on a tablet in landscape, where both are rendered', () => {
    // A tablet in landscape is wide *and* tall: it keeps the two-row layout
    // (only compact chrome collapses to one), so budgeting a single row sized
    // the text for half the height it renders into and clipped the expression.
    // iPad landscape: ~1024x768, so `available` is roughly 700 after chrome.
    const input: DisplayLayoutInput = {
      ...base,
      available: 700,
      preferredFontSize: 173,
      lineRatio: 1.2,
      displayRows: 2,
      ratioCap: 0.78, // landscape cap
    };
    const { fontSize, displayHeight } = computeDisplayLayout(input);
    expect(renderedRowsHeight(fontSize, input) + input.displayChrome).toBeLessThanOrEqual(
      displayHeight
    );
  });

  it('leaves a small preset on a roomy screen untouched by the keypad cap', () => {
    const { fontSize, kbHeight } = computeDisplayLayout({
      ...base,
      available: 840,
      preferredFontSize: 96,
    });
    expect(fontSize).toBe(96);
    // The display asks for less than the slack, so the cap decides the keypad.
    expect(kbHeight).toBeGreaterThan(840 * base.ratioCap - base.keypadRowCount);
  });
});

describe('fitFontSize', () => {
  it('shrinks the font by the proportion the text overruns its space', () => {
    // Half again too wide -> two thirds the size, less the safety margin.
    expect(fitFontSize(120, 900, 600)).toBe(78);
  });

  it('leaves a safety margin, so the fitted text does not touch the edge', () => {
    // The probe and the rendered row can disagree by a fraction of a point
    // (spacing, sub-pixel rounding); landing exactly on the width would let
    // that difference re-trigger the ellipsis.
    const fitted = fitFontSize(120, 900, 600);
    expect((900 * fitted) / 120).toBeLessThan(600);
  });

  it('returns a size whose text actually fits the space', () => {
    for (const fontSize of [96, 115, 130, 149, 173]) {
      for (const naturalWidth of [200, 760, 1427, 3000, 9000]) {
        for (const available of [320, 600, 760, 1000]) {
          const fitted = fitFontSize(fontSize, naturalWidth, available);
          // Width scales linearly with font size, so this is the width the
          // fitted size will render at.
          const fittedWidth = (naturalWidth * fitted) / fontSize;
          const floor = Math.ceil(fontSize * MIN_WIDTH_SCALE);
          // It fits, unless the legibility floor stopped it shrinking further.
          if (fitted > floor) expect(fittedWidth).toBeLessThanOrEqual(available + 1);
        }
      }
    }
  });

  it('leaves text that already fits at its full size', () => {
    expect(fitFontSize(173, 400, 760)).toBe(173);
    expect(fitFontSize(173, 760, 760)).toBe(173);
  });

  it('never shrinks below the legibility floor', () => {
    expect(fitFontSize(100, 100000, 100)).toBe(Math.ceil(100 * MIN_WIDTH_SCALE));
  });

  it('keeps the full size until a measurement arrives', () => {
    // The first frame renders before onLayout reports: it must not collapse to
    // some default, it must draw at the size the preset asked for.
    expect(fitFontSize(173, undefined, 760)).toBe(173);
    expect(fitFontSize(173, 0, 760)).toBe(173);
  });

  it('keeps the full size when the space is not yet known', () => {
    // displayWidth is 0 until the column lays out.
    expect(fitFontSize(173, 1427, 0)).toBe(173);
  });
});
