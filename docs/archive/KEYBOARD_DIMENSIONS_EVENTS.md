# Keyboard Dimensions Event System

## Overview

The keyboard now sends dimension updates to React Native via an event-based system using Darwin notifications for cross-process communication.

## Architecture

### Native Side (iOS)

#### 1. Keyboard Extension → Shared Preferences
When `BaseKeyboardViewController.updateKeyboardHeight()` is called:
- Stores dimensions in shared UserDefaults (App Group)
- Posts a **Darwin notification** (`CFNotificationCenter`) that can cross process boundaries

```swift
CFNotificationCenterPostNotification(
    CFNotificationCenterGetDarwinNotifyCenter(),
    CFNotificationName("com.issieboard.dimensionsChanged" as CFString),
    nil,
    nil,
    true
)
```

#### 2. Main App → React Native Bridge
`KeyboardPreferencesModule` (RCTEventEmitter):
- Listens for Darwin notifications from keyboard extension
- Fetches dimensions from shared preferences
- Emits React Native event `onKeyboardDimensionsChanged`

```swift
override init() {
    super.init()
    // Listen for Darwin notification
    CFNotificationCenterAddObserver(...)
}

private func handleDarwinNotification() {
    // Fetch from preferences and emit to React Native
    if let dimensions = preferences.getKeyboardDimensionsJSON() {
        sendEvent(withName: "onKeyboardDimensionsChanged", body: dimensions)
    }
}
```

### React Native Side (TypeScript)

#### KeyboardPreferences API

```typescript
// Add event listener (returns subscription with remove() method)
const subscription = KeyboardPreferences.addKeyboardDimensionsListener((dims) => {
  console.log('Dimensions changed:', dims);
  // dims = { width, height, device, orientation, keysetId, timestamp }
});

// Remove listener
subscription.remove();

// Fetch current dimensions (one-time)
const dims = await KeyboardPreferences.getKeyboardDimensions();
```

#### InteractiveCanvas Usage

```typescript
useEffect(() => {
  // Fetch initial dimensions
  const fetchInitialDimensions = async () => {
    const dims = await KeyboardPreferences.getKeyboardDimensions();
    if (dims) {
      setKeyboardDimensions(dims);
    }
  };

  fetchInitialDimensions();

  // Subscribe to changes
  const subscription = KeyboardPreferences.addKeyboardDimensionsListener((dims) => {
    setKeyboardDimensions(dims);
  });

  return () => subscription.remove();
}, []);
```

## Why Darwin Notifications?

**Problem**: Regular `NotificationCenter` doesn't work between app and keyboard extension (different processes/sandboxes)

**Solution**: Darwin notifications (`CFNotificationCenter`) work system-wide across processes

**Trade-off**: Darwin notifications can't carry userInfo, so we:
1. Store dimensions in shared UserDefaults
2. Send Darwin notification as a "ping"
3. Main app fetches dimensions from shared storage on receiving ping

## Event Flow

```
┌─────────────────────┐
│ Keyboard Extension  │
│ (BaseKeyboardVC)    │
└──────────┬──────────┘
           │ 1. Store dimensions
           ▼
   ┌───────────────────┐
   │ Shared UserDefaults│
   │   (App Group)      │
   └───────────────────┘
           │ 2. Post Darwin notification
           ▼
┌─────────────────────┐
│ Main App            │
│ KeyboardPreferences │
│ Module              │
└──────────┬──────────┘
           │ 3. Fetch dimensions
           │    from shared storage
           ▼
   ┌───────────────────┐
   │ React Native      │
   │ Event Emitter     │
   └───────────────────┘
           │ 4. Emit event
           ▼
┌─────────────────────┐
│ InteractiveCanvas   │
│ Component           │
└─────────────────────┘
```

## When Events Are Fired

Dimensions are updated and events are sent whenever:
- Keyboard is first rendered
- Device orientation changes
- Keyset switches
- Configuration changes (keyHeight, keyGap, suggestions enabled/disabled)
- View layout changes

## Benefits

1. **Real-time**: Instant updates when keyboard dimensions change
2. **Efficient**: No polling - event-driven
3. **Cross-process**: Works between app and keyboard extension
4. **Reliable**: Darwin notifications are system-level and guaranteed delivery
5. **Clean API**: Subscribe/unsubscribe pattern with automatic cleanup

## Debugging

Check console logs:
- `📐 Initial keyboard dimensions:` - Initial fetch on mount
- `📐 Keyboard dimensions changed:` - Event received
- Look for the dimensions object: `{ width, height, device, orientation, keysetId, timestamp }`

If not receiving events:
1. Ensure keyboard extension has been opened at least once
2. Check App Groups are configured correctly
3. Verify Darwin notification name matches: `com.issieboard.dimensionsChanged`
4. Check that `updateKeyboardHeight()` is being called in the keyboard extension
