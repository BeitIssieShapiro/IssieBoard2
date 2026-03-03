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

interface KeyboardPreviewProps {
  style?: StyleProp<ViewStyle>;
  configJson?: string;
  /** JSON array of selected key IDs for visual highlighting, e.g., '["abc:0:3", "abc:1:2"]' */
  selectedKeys?: string;
  language?: string;
  /** Current text content - used to sync keyboard state with external text changes */
  text?: string;
  onKeyPress?: (event: KeyPressEvent) => void;
  onSuggestionsChange?: (event: SuggestionsChangeEvent) => void;
  onLanguageChange?: (event: LanguageChangeEvent) => void;
  onHeightChange?: (event: HeightChangeEvent) => void;
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
  // Track previous language for change detection
  const prevLanguage = React.useRef<string | undefined>(props.language);
  const [configJson, setConfigJson] = React.useState<string | undefined>(props.configJson);
  
  React.useEffect(() => {
    const componentName = 'KeyboardPreviewView';
    const isRegistered = UIManager.getViewManagerConfig(componentName);
    console.log(`[KeyboardPreview] Component ${componentName} registered on ${Platform.OS}:`, !!isRegistered);
    if (!isRegistered) {
      console.error(`[KeyboardPreview] ${componentName} is NOT registered!`);
    }
  }, []);
  
  // Update configJsonString when language changes
  React.useEffect(() => {
    // Only update if the language has actually changed
    if (props.language !== prevLanguage.current) {
      console.log(`[KeyboardPreview] Language changed from ${prevLanguage.current} to ${props.language}`);
      prevLanguage.current = props.language;
      
      // Update configJson when language changes to ensure native side gets the new language
      if (props.configJson) {
        try {
          const config = JSON.parse(props.configJson);
          // Set language in config
          config.language = props.language;
          // Update configJson with the new language
          setConfigJson(JSON.stringify(config));
        } catch (e) {
          console.error('Error updating configJson with language:', e);
          setConfigJson(props.configJson);
        }
      }
    } else if (props.configJson !== configJson) {
      setConfigJson(props.configJson);
    }
  }, [props.language, props.configJson]);
  
  console.log(`[KeyboardPreview] Rendering on ${Platform.OS} with configJson length:`, configJson?.length || 0);
  
  return <NativeKeyboardPreview {...props} configJson={configJson} />;
};

export type { KeyboardPreviewProps, KeyPressEvent, SuggestionsChangeEvent, LanguageChangeEvent, HeightChangeEvent };