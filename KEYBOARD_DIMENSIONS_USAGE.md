# Keyboard Dimensions Usage

## Overview

The native keyboard now reports its calculated dimensions (width, height, device type, orientation) back to React Native via shared preferences. This allows the settings app to display the actual keyboard size.

## How It Works

1. **Native Side**: When `BaseKeyboardViewController.updateKeyboardHeight()` is called, it stores the calculated dimensions in shared preferences via `KeyboardPreferences`
2. **React Native Side**: The app can retrieve these dimensions using `KeyboardPreferences.getKeyboardDimensions()`

## Dimensions Structure

```typescript
interface KeyboardDimensions {
  width: number;       // Keyboard width in points
  height: number;      // Calculated keyboard height in points
  device: string;      // "iPhone" or "iPad"
  orientation: string; // "portrait" or "landscape"
  keysetId: string;    // Current keyset (e.g., "he_abc", "en_ABC")
  timestamp: number;   // Unix timestamp when dimensions were calculated
}
```

## Usage Example

### Polling for dimensions in EditorScreen

```typescript
import KeyboardPreferences, { KeyboardDimensions } from '../native/KeyboardPreferences';

const EditorScreenContent: React.FC<EditorScreenContentProps> = (props) => {
  const [keyboardDimensions, setKeyboardDimensions] = useState<KeyboardDimensions | null>(null);

  // Poll for keyboard dimensions every 2 seconds
  useEffect(() => {
    const pollDimensions = async () => {
      const dims = await KeyboardPreferences.getKeyboardDimensions();
      if (dims) {
        setKeyboardDimensions(dims);
      }
    };

    pollDimensions(); // Initial fetch
    const interval = setInterval(pollDimensions, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View>
      {/* Show dimensions info */}
      {keyboardDimensions && (
        <View style={styles.dimensionsInfo}>
          <Text>📐 Keyboard: {Math.round(keyboardDimensions.width)} × {Math.round(keyboardDimensions.height)} pt</Text>
          <Text>📱 {keyboardDimensions.device} ({keyboardDimensions.orientation})</Text>
          <Text>⌨️ Keyset: {keyboardDimensions.keysetId}</Text>
        </View>
      )}

      {/* Rest of your UI */}
    </View>
  );
};
```

### Display in GlobalSettingsPanel

```typescript
const GlobalSettingsPanel: React.FC = () => {
  const [dimensions, setDimensions] = useState<KeyboardDimensions | null>(null);

  useEffect(() => {
    const fetchDimensions = async () => {
      const dims = await KeyboardPreferences.getKeyboardDimensions();
      setDimensions(dims);
    };

    fetchDimensions();
    const interval = setInterval(fetchDimensions, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ScrollView>
      {/* Display keyboard info */}
      {dimensions && (
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Live Keyboard Info</Text>
          <Text>Height: {Math.round(dimensions.height)}pt</Text>
          <Text>Width: {Math.round(dimensions.width)}pt</Text>
          <Text>Device: {dimensions.device}</Text>
          <Text>Orientation: {dimensions.orientation}</Text>
          <Text>Keyset: {dimensions.keysetId}</Text>
        </View>
      )}

      {/* Rest of settings */}
    </ScrollView>
  );
};
```

## When Dimensions Are Updated

Dimensions are recalculated and stored whenever:
- The keyboard is first rendered
- The device orientation changes
- The keyboard switches to a different keyset
- The configuration changes (e.g., keyHeight, keyGap, suggestions enabled/disabled)
- The keyboard view layout changes

## Notes

- The keyboard must be opened at least once for dimensions to be available
- Dimensions are stored per keyboard language (each extension updates independently)
- The timestamp field can be used to detect stale data
- Returns `null` if the keyboard hasn't been opened yet or if preferences are unavailable
