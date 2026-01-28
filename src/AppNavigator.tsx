/**
 * AppNavigator - Simple navigation wrapper for the Keyboard Studio app
 * 
 * Provides navigation between:
 * - Legacy JSON-based configuration screen (default for now)
 * - New Visual Editor screen (Phase 1)
 * 
 * This uses simple state-based navigation to avoid adding new dependencies.
 * Can be upgraded to react-navigation later if needed.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { EditorScreen } from './screens/EditorScreen';
import { LegacyConfigScreen } from './screens/LegacyConfigScreen';

type Screen = 
  | { type: 'legacy' }
  | { type: 'editor'; profileId?: string };

export const AppNavigator: React.FC = () => {
  // Start with the new Editor screen by default
  const [currentScreen, setCurrentScreen] = useState<Screen>({ type: 'editor' });

  const navigateToEditor = useCallback((profileId?: string) => {
    setCurrentScreen({ type: 'editor', profileId });
  }, []);

  const navigateToLegacy = useCallback(() => {
    setCurrentScreen({ type: 'legacy' });
  }, []);

  return (
    <View style={styles.container}>
      {currentScreen.type === 'legacy' ? (
        <LegacyConfigScreen 
          onSwitchToEditor={() => navigateToEditor()} 
        />
      ) : (
        <EditorScreen 
          profileId={currentScreen.profileId}
          onBack={navigateToLegacy}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AppNavigator;