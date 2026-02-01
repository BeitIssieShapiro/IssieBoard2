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
  alwaysInclude?: boolean;
}

interface KeyboardRow {
  keys: KeyboardKey[];
  alwaysInclude?: boolean;
}

interface Keyset {
  id: string;
  rows: KeyboardRow[];
}

interface CommonKeysets {
  keysets: Keyset[];
}

declare const commonKeysets: CommonKeysets;
export = commonKeysets;