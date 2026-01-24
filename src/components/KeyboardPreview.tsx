import React from 'react';
import { requireNativeComponent, ViewStyle, StyleProp, UIManager, Platform } from 'react-native';

interface KeyPressEvent {
  nativeEvent: {
    type: string;
    value: string;
    label: string;
    hasNikkud: boolean;
  };
}

interface KeyboardPreviewProps {
  style?: StyleProp<ViewStyle>;
  configJson?: string;
  onKeyPress?: (event: KeyPressEvent) => void;
}

const NativeKeyboardPreview = requireNativeComponent<KeyboardPreviewProps>('KeyboardPreviewView');

/**
 * Native keyboard preview component for Android
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
 * />
 * ```
 */
export const KeyboardPreview: React.FC<KeyboardPreviewProps> = (props) => {
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const componentName = 'KeyboardPreviewView';
      const isRegistered = UIManager.getViewManagerConfig(componentName);
      console.log(`[KeyboardPreview] Component ${componentName} registered:`, !!isRegistered);
      if (!isRegistered) {
        console.error(`[KeyboardPreview] ${componentName} is NOT registered! Check MainApplication.kt`);
      }
    }
  }, []);
  
  console.log('[KeyboardPreview] Rendering with configJson length:', props.configJson?.length || 0);
  
  if (Platform.OS !== 'android') {
    return null;
  }
  
  return <NativeKeyboardPreview {...props} />;
};

export type { KeyboardPreviewProps, KeyPressEvent };
