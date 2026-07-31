# Rounded Keys Feature Design

**Date:** 2026-07-31  
**Scope:** iOS only (native keyboard renderer)

## Summary

Add a `roundedKeys` boolean to `KeyboardConfig`. When true, key corner radius becomes 50% of the key height (pill/circle shape). Injected via `default_config.json` for IssieCalc — no settings UI.

## Changes

### 1. `ios/Shared/KeyboardModels.swift` — `KeyboardConfig`

- Add `let roundedKeys: Bool?` property
- Add `case roundedKeys` to `CodingKeys`

### 2. `ios/Shared/KeyboardRenderer.swift`

- Change `private let keyCornerRadius: CGFloat = 5` from a stored constant to a computed property:
  ```swift
  private var keyCornerRadius: CGFloat {
      guard config?.roundedKeys == true else { return 5 }
      return rowHeight * 0.5
  }
  ```
- Use `rowHeight` (unscaled), NOT `scaledRowHeight`. `scaledCornerRadius` multiplies by `effectiveDimensionScale` — using `scaledRowHeight` would double-scale in preview mode.
- `scaledCornerRadius` requires no changes — it already handles scale correctly.

### 3. `ios/IssieCalc/default_config.json`

- Add `"roundedKeys": true` at the top level.

## Constraints

- No Android changes (iOS-first rule)
- No settings UI
- No changes to other keyboards or profiles
- Defaults to `false` when field absent (nil-coalescing)
