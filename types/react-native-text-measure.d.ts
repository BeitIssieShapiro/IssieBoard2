declare module 'react-native-text-measure' {
  export interface TextMeasureOptions {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    fontStyle?: 'normal' | 'italic';
    letterSpacing?: number;
    lineHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
    numberOfLines?: number;
    includeFontPadding?: boolean;
  }

  export interface TextMeasureResult {
    width: number;
    height: number;
    lineCount: number;
  }

  export function measureText(text: string, options?: TextMeasureOptions): Promise<TextMeasureResult>;
  export function measureTextSync(text: string, options?: TextMeasureOptions): TextMeasureResult;
}
