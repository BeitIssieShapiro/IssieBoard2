# Testing Strategy for IssieBoardNG Native Code

This document describes the cross-platform testing strategy for the native iOS (Swift) and Android (Kotlin) keyboard implementations.

## Overview

The native code is tested using **JSON-based test fixtures** that serve as a single source of truth for both platforms. This approach ensures:

1. **Consistency**: Both iOS and Android implementations produce identical outputs for identical inputs
2. **Maintainability**: Test cases are defined once in JSON, no duplication
3. **Readability**: Test data is human-readable and version-controllable
4. **Easy extension**: Adding new tests only requires adding JSON files

## Test Structure

```
IssieBoardNG/
├── __tests__/
│   └── fixtures/
│       └── diacritics/           # Diacritics generation test cases
│           ├── hebrew_bet_dagesh.json
│           ├── hebrew_alef_no_dagesh.json
│           ├── hebrew_shin_multi_option.json
│           ├── hebrew_vav_replacement.json
│           └── hebrew_hidden_settings.json
├── ios/
│   └── IssieBoardNGTests/
│       └── DiacriticsGeneratorTests.swift
└── android/
    └── app/src/test/java/com/issieboardng/
        └── DiacriticsGeneratorTest.kt
```

## Test Fixture Format

Each JSON fixture has the following structure:

```json
{
  "name": "Test case name",
  "description": "What this test verifies",
  "input": {
    "letter": "ב",               // The letter to generate diacritics for
    "diacritics": {              // DiacriticsDefinition
      "items": [...],
      "modifiers": [...]
    },
    "settings": {                // DiacriticsSettings (optional)
      "hidden": [...],
      "disabledModifiers": [...]
    }
  },
  "expected": [                  // Expected output array
    { "id": "plain", "value": "ב", "name": "ללא" },
    { "id": "kamatz", "value": "בָ", "name": "קָמָץ" }
  ]
}
```

## What's Being Tested

### 1. Diacritics Generation
- Basic diacritics (vowels) for Hebrew letters
- Modifier application (dagesh)
- Multi-option modifiers (shin/sin)
- Replacement diacritics (cholam male, shuruk for Vav)
- `onlyFor` / `excludeFor` filtering
- Profile settings (hidden items, disabled modifiers)

### 2. ShiftState
- State transitions (toggle, lock, unlock)
- `isActive()` method

### 3. Color Parsing
- 6-digit hex colors (#FF0000)
- 8-digit hex colors with alpha (#FF000080)
- With/without # prefix
- Invalid input handling

## Running Tests

### Android Tests

From the project root:

```bash
# Run all unit tests
cd android && ./gradlew test

# Run specific test class
cd android && ./gradlew test --tests "com.issieboardng.DiacriticsGeneratorTest"

# Run with verbose output
cd android && ./gradlew test --info
```

From Android Studio:
- Open the test file
- Click the green play button next to a test method or class

### iOS Tests

From the command line:

```bash
# Run tests using xcodebuild (use an available simulator)
cd ios && xcodebuild test \
  -workspace IssieBoardNG.xcworkspace \
  -scheme IssieBoardNG \
  -destination 'platform=iOS Simulator,name=iPhone 17'

# Or use any iOS simulator
cd ios && xcodebuild test \
  -workspace IssieBoardNG.xcworkspace \
  -scheme IssieBoardNG \
  -destination 'platform=iOS Simulator,name=Any iOS Simulator Device'
```

From Xcode:
1. Open `IssieBoardNG.xcworkspace`
2. Select the test target
3. Press Cmd+U to run all tests
4. Or click the diamond icon next to a test method

### Setting Fixtures Path (if needed)

If tests can't find fixtures, set the environment variable:

```bash
export TEST_FIXTURES_PATH=/path/to/IssieBoardNG/__tests__/fixtures/diacritics
```

## Adding New Test Cases

1. Create a new JSON file in `__tests__/fixtures/diacritics/`
2. Follow the fixture format above
3. Tests will automatically pick it up via `testAllFixtures()`
4. Optionally add a dedicated test method for clarity

### Example: Adding an Arabic test

Create `__tests__/fixtures/diacritics/arabic_fatha.json`:

```json
{
  "name": "Arabic Ba with Fatha",
  "description": "Tests Arabic tashkeel (diacritics) for the letter Ba",
  "input": {
    "letter": "ب",
    "diacritics": {
      "items": [
        { "id": "plain", "mark": "", "name": "بدون" },
        { "id": "fatha", "mark": "\u064E", "name": "فَتْحة" }
      ],
      "modifiers": []
    },
    "settings": null
  },
  "expected": [
    { "id": "plain", "value": "ب", "name": "بدون" },
    { "id": "fatha", "value": "بَ", "name": "فَتْحة" }
  ]
}
```

## Troubleshooting

### Tests can't find fixtures
- Verify `__tests__/fixtures/diacritics/` directory exists
- Check working directory when running tests
- Use `TEST_FIXTURES_PATH` environment variable

### iOS module import errors
- Ensure test target has access to `KeyboardModels.swift`
- Check that `@testable import IssieBoardNG` works
- The test target may need the `Shared` folder added to its sources

### Android class not found
- Ensure `KeyboardModels.kt` classes are in the main source set
- Check that the test can access the `com.issieboardng` package

## CI Integration

Example GitHub Actions workflow:

```yaml
name: Native Tests

on: [push, pull_request]

jobs:
  android-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          java-version: '17'
          distribution: 'temurin'
      - run: cd android && ./gradlew test

  ios-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - run: |
          cd ios
          xcodebuild test \
            -workspace IssieBoardNG.xcworkspace \
            -scheme IssieBoardNG \
            -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Future Improvements

- [ ] Add config parsing tests (JSON → model objects)
- [ ] Add keyboard layout calculation tests
- [ ] Add Arabic diacritics test fixtures
- [ ] Add rendering dimension tests
- [ ] Integration tests for keyboard preview