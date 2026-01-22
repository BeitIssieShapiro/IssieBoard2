// Platform-specific keyboard preferences module
// Re-exports types and the default export from the iOS implementation
// The .ios.ts and .android.ts extensions are automatically selected by React Native

export type { PreferenceInfo, SetResult } from './KeyboardPreferences.ios';
export { default } from './KeyboardPreferences.ios';
