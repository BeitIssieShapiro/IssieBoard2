import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import KeyboardPreferences from '../native/KeyboardPreferences';
import type { KeyboardSetupStatus } from '../native/KeyboardPreferences';

export type { KeyboardSetupStatus };

/**
 * Hook that checks whether a keyboard extension is added in iOS Settings
 * and whether Full Access is enabled.
 *
 * Re-checks on mount, language change, and when app returns to foreground.
 * Returns null values while loading or on Android (where setup is always "done").
 */
export function useKeyboardSetupStatus(language: string): KeyboardSetupStatus {
  const [status, setStatus] = useState<KeyboardSetupStatus>({
    isAdded: null,
    hasFullAccess: null,
  });

  const checkStatus = useCallback(async () => {
    try {
      const result = await KeyboardPreferences.getKeyboardSetupStatus(language);
      setStatus(result);
    } catch {
      setStatus({ isAdded: null, hasFullAccess: null });
    }
  }, [language]);

  // Check on mount and language change
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Re-check when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkStatus();
      }
    });
    return () => subscription.remove();
  }, [checkStatus]);

  return status;
}
