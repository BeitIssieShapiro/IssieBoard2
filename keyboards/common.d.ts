/**
 * TypeScript declaration for common.js
 */

interface KeyboardKey {
  value?: string;
  sValue?: string;
  caption?: string;
  sCaption?: string;
  type?: string;
  width?: number;
  offset?: number;
  hidden?: boolean;
  color?: string;
  bgColor?: string;
  label?: string;
  keysetValue?: string;
  returnKeysetValue?: string;
  returnKeysetLabel?: string;
  forLanguages?: string[];
  ifHasDiacritics?: boolean;
  showForField?: string[];
  flex?: boolean;
  fontSize?: number;
}

interface KeyboardRow {
  keys: KeyboardKey[];
}

interface RowInjection {
  prepend?: KeyboardKey[];
  append?: KeyboardKey[];
}

interface KeysetOverride {
  firstRow?: RowInjection;
  secondRow?: RowInjection;
  lastRow?: RowInjection;
}

interface StructuralVariant {
  firstRow?: RowInjection;
  secondRow?: RowInjection;
  lastRow?: RowInjection;
  keysetOverrides?: Record<string, KeysetOverride>;
  bottomRow: KeyboardKey[];
}

interface Structural {
  mobile: StructuralVariant;
  large: StructuralVariant;
}

interface Keyset {
  id: string;
  rows: KeyboardRow[];
}

interface CommonKeysets {
  structural: Structural;
  keysets: Keyset[];
}

declare const commonKeysets: CommonKeysets;
export = commonKeysets;
