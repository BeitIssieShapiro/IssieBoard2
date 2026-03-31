import React from 'react';
import { requireNativeComponent, ViewStyle, StyleProp, UIManager, Platform } from 'react-native';

interface KeyPressEvent {
  nativeEvent: {
    type: string;
    value: string;
    label: string;
    hasNikkud: boolean;
    keysetValue?: string;
    returnKeysetValue?: string;
    returnKeysetLabel?: string;
  };
}

interface SuggestionsChangeEvent {
  nativeEvent: {
    suggestions: string[];
  };
}

interface LanguageChangeEvent {
  nativeEvent: {
    language: string;
  };
}

interface HeightChangeEvent {
  nativeEvent: {
    height: number;
    keysetId: string;
  };
}

interface OpenSettingsEvent {
  nativeEvent: {};
}

interface KeyboardPreviewProps {
  style?: StyleProp<ViewStyle>;
  configJson?: string;
  /** JSON array of selected key IDs for visual highlighting, e.g., '["abc:0:3", "abc:1:2"]' */
  selectedKeys?: string;
  language?: string;
  /** Current text content - used to sync keyboard state with external text changes */
  text?: string;
  /** Maximum height for preview scaling (keyboard will scale proportionally to fit) */
  maxHeight?: number;
  /** Hide the globe (next-keyboard) button in the preview (default: false, follows config) */
  hideGlobeButton?: boolean;
  onKeyPress?: (event: KeyPressEvent) => void;
  onSuggestionsChange?: (event: SuggestionsChangeEvent) => void;
  onLanguageChange?: (event: LanguageChangeEvent) => void;
  onHeightChange?: (event: HeightChangeEvent) => void;
  onOpenSettings?: (event: OpenSettingsEvent) => void;
}

const NativeKeyboardPreview = requireNativeComponent<KeyboardPreviewProps>('KeyboardPreviewView');

/**
 * Native keyboard preview component for iOS
 * Renders the actual keyboard layout as it would appear in the keyboard extension
 * 
 * @example
 * ```tsx
 * <KeyboardPreview
 *   style={{ height: 250 }}
 *   configJson={configJson}
 *   onKeyPress={(event) => {
 *     console.log('Key pressed:', event.nativeEvent);
 *   }}
 *   onSuggestionsChange={(event) => {
 *     console.log('Suggestions:', event.nativeEvent.suggestions);
 *   }}
 * />
 * ```
 */
export const KeyboardPreview: React.FC<KeyboardPreviewProps> = (props) => {
  React.useEffect(() => {
    const componentName = 'KeyboardPreviewView';
    const isRegistered = UIManager.getViewManagerConfig(componentName);
    console.log(`[KeyboardPreview] Component ${componentName} registered on ${Platform.OS}:`, !!isRegistered);
    if (!isRegistered) {
      console.error(`[KeyboardPreview] ${componentName} is NOT registered!`);
    }
  }, []);

  console.log(`[KeyboardPreview] Rendering on ${Platform.OS} with configJson length:`, props.configJson?.length || 0);

  return <NativeKeyboardPreview {...props} />;
};

export type { KeyboardPreviewProps, KeyPressEvent, SuggestionsChangeEvent, LanguageChangeEvent, HeightChangeEvent, OpenSettingsEvent };