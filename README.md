# IssieBoard
IssieBoard is a configurable extension keyboard application for iOS that helps users with developmental or motor skill disabilities to acquire typing skills. IssieBoard can help people who have visual impairments, learning disabilities, cerebral palsy, and developmental and mental disabilities.

Keyboard Features

Control the colors of all the keys in the keyboard, and the letters and text color, including the enter, space, backspace, globe, and dismiss keyboard keys. You can also control the keyboard background color.
Divide the letters and numbers keys into three sections by row or column and control the colors of each section separately.
Choose which keyboard keys will be visible.
Select the keyboard appearance from a set of pre-configured templates.
Configure a set of special letters and/or numbers, and configure the appearance of this set separately.

## Architecture
This project utilizes a Hybrid Architecture designed to overcome the strict memory and performance constraints of system-wide keyboards on both iOS and Android.

The Configurator (React Native): The user-facing application is built in React Native, serving as a unified cross-platform editor. It handles the "heavy lifting"—YAML parsing, validation, and theme management—entirely in JavaScript, outputting a lightweight, platform-agnostic JSON configuration.

The Data Bridge: Storage is handled via platform-specific shared containers to bridge the gap between the App and the Extension.

Android: Writes to SharedPreferences (accessible by the Service).

iOS: Writes to UserDefaults within an App Group (accessible by the Extension).

The Native Engines: The keyboard runtimes are written in 100% Pure Native Code (Kotlin for Android InputMethodService and Swift for iOS UIInputViewController). They are completely decoupled from the React Native Bridge, ensuring instant startup (<50ms) and staying well within strict OS memory limits (critical for the iOS 50MB extension limit).

Dynamic Rendering: Instead of hardcoded layouts, both native engines feature a custom Dynamic View Inflater. This engine reads the cached JSON configuration at runtime to programmatically build the keyboard UI (rows, keys, and styling) using native components (LinearLayout on Android, UIStackView on iOS).

Live Synchronization: Both platforms implement reactive listeners (OnSharedPreferenceChangeListener on Android and KVO/NotificationCenter on iOS) to detect configuration changes instantly, allowing the keyboard to "hot-reload" new themes without requiring a crash or restart.

System Integration: The architecture respects platform-specific UI paradigms, automatically handling Edge-to-Edge content and safe area insets (like the Home Indicator on iOS and Gesture Bar on Android) to ensure a seamless fit on modern devices.

Summary: By isolating the configuration logic in React Native and keeping the runtime engines pure native, the app achieves a "Write Once, Configure Everywhere" developer experience while delivering the raw performance and stability required by the operating systems.