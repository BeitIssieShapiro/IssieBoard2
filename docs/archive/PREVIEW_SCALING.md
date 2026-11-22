# Keyboard Preview Dynamic Scaling

## Overview

The keyboard preview in EditorScreen now automatically scales to fit the available space based on the actual native keyboard dimensions.

## How It Works

### 1. Native Dimensions Polling

The `InteractiveCanvas` component polls for keyboard dimensions every 2 seconds:

```typescript
useEffect(() => {
  const fetchDimensions = async () => {
    const dims = await KeyboardPreferences.getKeyboardDimensions();
    if (dims) {
      setKeyboardDimensions(dims);
    }
  };

  fetchDimensions(); // Initial fetch
  const interval = setInterval(fetchDimensions, 2000); // Poll every 2 seconds
  return () => clearInterval(interval);
}, []);
```

### 2. Container Width Measurement

The container measures its own width using `onLayout`:

```typescript
<View
  style={styles.container}
  onLayout={(event) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  }}
>
```

### 3. Scale Factor Calculation

The scale factor is calculated based on:
- **Available Width**: Container width minus padding (32px)
- **Native Keyboard Width**: The actual width from native dimensions
- **Scale Rule**: Never scale up (max scale = 1), only scale down to fit

```typescript
const { scaleFactor, scaledHeight, scaledWidth } = useMemo(() => {
  if (!keyboardDimensions || !containerWidth) {
    return { scaleFactor: 1, scaledHeight: previewHeight, scaledWidth: containerWidth };
  }

  const availableWidth = containerWidth - 32; // Account for padding
  const widthScale = availableWidth / keyboardDimensions.width;
  const finalScale = Math.min(widthScale, 1); // Never scale up, only down

  return {
    scaleFactor: finalScale,
    scaledHeight: keyboardDimensions.height * finalScale,
    scaledWidth: keyboardDimensions.width * finalScale,
  };
}, [keyboardDimensions, containerWidth, previewHeight]);
```

### 4. Transform Application

The scale is applied using CSS transform:

```typescript
<View style={[styles.previewWrapper, { height: scaledHeight || previewHeight }]}>
  <KeyboardPreview
    style={[
      styles.preview,
      {
        height: keyboardDimensions?.height || previewHeight,
        width: keyboardDimensions?.width || containerWidth,
        transform: [{ scale: scaleFactor }],
      }
    ]}
    configJson={configJson}
    onKeyPress={handleKeyPress}
  />
</View>
```

### 5. Dimensions Display

The preview header shows:
- Native keyboard dimensions in points
- Scale percentage (if scaled down)

```
Preview         עברית         428×216pt (85%)
```

## Benefits

1. **Accurate Preview**: Shows the exact size the keyboard will be on the actual device
2. **Responsive**: Automatically adjusts when:
   - Window is resized (iPad split screen)
   - Device orientation changes
   - Keyboard configuration changes (keyHeight, keyGap, etc.)
3. **No Overflow**: Keyboard is always scaled to fit within the available space
4. **Real-time Updates**: Polls native dimensions every 2 seconds

## Fallback Behavior

If native dimensions are not available (keyboard hasn't been opened yet):
- Uses calculated `previewHeight` based on number of rows
- Uses container width
- Scale factor = 1 (no scaling)

## Visual Feedback

Users can see:
- The actual keyboard dimensions in the header
- The scale percentage if the keyboard is scaled down
- A perfectly proportional preview that matches the real keyboard
