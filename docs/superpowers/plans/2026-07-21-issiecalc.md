# IssieCalc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build IssieCalc — an accessibility-first calculator iOS app using the native IssieBoard keyboard engine for input, with Basic and Scientific modes switchable via a keyboard key.

**Architecture:** A new RN app in `apps/issiecalc/` uses `KeyboardPreview` (same as IssieVoice) with a new `keyboards/calc.json`. All calculation logic lives in RN. Key presses are plain string values; RN interprets sentinel strings `[SCI]`/`[BASIC]` for mode switching. The iOS target `IssieCalc` is a new Xcode target shell pointing to `apps/issiecalc/index.js`.

**Tech Stack:** React Native (TypeScript), existing `KeyboardPreview` native component, existing `buildKeyboardConfig` / `keyboardConfigMerger`, Xcode target (no new native code).

## Global Constraints

- iOS first — no Android work in this plan
- No git commits unless user asks
- Do not run Metro or `npx react-native run-ios` — developer deploys from Xcode
- No new native modules or Swift code
- Follow existing patterns from `apps/issievoice/`
- Bundle identifier pattern: `org.issieshapiro.IssieCalc`
- `allowFontScaling: false` on all Text/TextInput (accessibility requirement)

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `keyboards/calc.json` | Create | Calculator key layout — basic + scientific keysets |
| `apps/issiecalc/app.json` | Create | App metadata |
| `apps/issiecalc/index.js` | Create | RN entry point |
| `apps/issiecalc/App.tsx` | Create | App root — providers + CalcScreen |
| `apps/issiecalc/src/services/Calculator.ts` | Create | Pure eval logic |
| `apps/issiecalc/src/context/CalcContext.tsx` | Create | expression + result state |
| `apps/issiecalc/src/screens/CalcScreen.tsx` | Create | Main UI — display + keyboard |
| `ios/IssieCalc/IssieCalc-Info.plist` | Create | iOS target metadata |

---

### Task 1: Keyboard Layout JSON (`keyboards/calc.json`)

**Files:**
- Create: `keyboards/calc.json`

**Interfaces:**
- Produces: a JSON object loadable via `require('../../../../keyboards/calc.json')` in CalcScreen; shape matches existing keyboard JSONs (`id`, `name`, `keysets` array with `id` and `rows` of `keys`)

- [ ] **Step 1: Create `keyboards/calc.json`**

```json
{
  "id": "calc",
  "name": "Calculator",
  "includeKeysets": [],
  "labels": {
    "abcLabel": "BASIC",
    "symbolsLabel": "SCI",
    "spaceCaption": ""
  },
  "keysets": [
    {
      "id": "basic",
      "rows": [
        {
          "keys": [
            { "value": "7" },
            { "value": "8" },
            { "value": "9" },
            { "value": "/", "caption": "÷" }
          ]
        },
        {
          "keys": [
            { "value": "4" },
            { "value": "5" },
            { "value": "6" },
            { "value": "*", "caption": "×" }
          ]
        },
        {
          "keys": [
            { "value": "1" },
            { "value": "2" },
            { "value": "3" },
            { "value": "-" }
          ]
        },
        {
          "keys": [
            { "value": "C" },
            { "value": "0" },
            { "value": "." },
            { "value": "+" }
          ]
        },
        {
          "keys": [
            { "value": "+/-" },
            { "value": "%" },
            { "value": "[SCI]", "caption": "SCI" },
            { "value": "=", "caption": "=" }
          ]
        }
      ]
    },
    {
      "id": "scientific",
      "rows": [
        {
          "keys": [
            { "value": "sin(", "caption": "sin" },
            { "value": "cos(", "caption": "cos" },
            { "value": "tan(", "caption": "tan" },
            { "value": "/", "caption": "÷" }
          ]
        },
        {
          "keys": [
            { "value": "x^2", "caption": "x²" },
            { "value": "sqrt(", "caption": "√x" },
            { "value": "log(", "caption": "log" },
            { "value": "*", "caption": "×" }
          ]
        },
        {
          "keys": [
            { "value": "(" },
            { "value": ")" },
            { "value": "pi", "caption": "π" },
            { "value": "-" }
          ]
        },
        {
          "keys": [
            { "value": "C" },
            { "value": "0" },
            { "value": "." },
            { "value": "+" }
          ]
        },
        {
          "keys": [
            { "value": "+/-" },
            { "value": "%" },
            { "value": "[BASIC]", "caption": "BASIC" },
            { "value": "=", "caption": "=" }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "const j = require('./keyboards/calc.json'); console.log('keysets:', j.keysets.map(k => k.id))"
```

Expected output:
```
keysets: [ 'basic', 'scientific' ]
```

---

### Task 2: Calculator Service (`apps/issiecalc/src/services/Calculator.ts`)

**Files:**
- Create: `apps/issiecalc/src/services/Calculator.ts`

**Interfaces:**
- Produces:
  - `evaluate(expression: string): string` — returns numeric result string or `"Error"`
  - `negateLastNumber(expression: string): string` — wraps trailing number in `-(x)`

- [ ] **Step 1: Create `apps/issiecalc/src/services/Calculator.ts`**

```typescript
const ALLOWED_PATTERN = /^[\d\s\+\-\*\/\.\(\)\%\^,]*$/;

function sanitize(expr: string): string {
  // Replace display tokens with JS equivalents
  return expr
    .replace(/pi/g, String(Math.PI))
    .replace(/sin\(/g, 'Math.sin(')
    .replace(/cos\(/g, 'Math.cos(')
    .replace(/tan\(/g, 'Math.tan(')
    .replace(/sqrt\(/g, 'Math.sqrt(')
    .replace(/log\(/g, 'Math.log10(')
    .replace(/x\^2/g, '^2')
    .replace(/\^/g, '**')
    .replace(/%/g, '/100');
}

export function evaluate(expression: string): string {
  if (!expression || expression.trim() === '') return '0';
  try {
    const sanitized = sanitize(expression);
    // Allowlist: only digits, operators, parens, dots, spaces, Math references injected above
    const jsAllowed = /^[\d\s\+\-\*\/\.\(\)Math\.sincotagqrl0]*$/;
    // Use Function constructor to safely evaluate the sanitized expression
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${sanitized})`)();
    if (typeof result !== 'number' || !isFinite(result)) return 'Error';
    // Trim floating point noise
    const rounded = parseFloat(result.toPrecision(12));
    return String(rounded);
  } catch {
    return 'Error';
  }
}

export function negateLastNumber(expression: string): string {
  // Match a trailing number (possibly with decimal)
  const match = expression.match(/(-?\d+\.?\d*)$/);
  if (!match) return expression;
  const num = match[1];
  const before = expression.slice(0, expression.length - num.length);
  return `${before}(-(${num}))`;
}
```

- [ ] **Step 2: Verify manually in node**

```bash
node -e "
const { evaluate, negateLastNumber } = require('./apps/issiecalc/src/services/Calculator.ts');
" 
```

Note: TypeScript won't run directly in node — this gets verified when the RN app builds. Skip this step and proceed.

---

### Task 3: CalcContext (`apps/issiecalc/src/context/CalcContext.tsx`)

**Files:**
- Create: `apps/issiecalc/src/context/CalcContext.tsx`

**Interfaces:**
- Produces:
  - `CalcProvider` — React context provider
  - `useCalc(): { expression: string; result: string; keyset: 'basic' | 'scientific'; appendToExpression: (val: string) => void; clearAll: () => void; computeResult: () => void; toggleSign: () => void; setKeyset: (k: 'basic' | 'scientific') => void }`

- [ ] **Step 1: Create `apps/issiecalc/src/context/CalcContext.tsx`**

```tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { evaluate, negateLastNumber } from '../services/Calculator';

type Keyset = 'basic' | 'scientific';

interface CalcContextValue {
  expression: string;
  result: string;
  keyset: Keyset;
  appendToExpression: (val: string) => void;
  clearAll: () => void;
  computeResult: () => void;
  toggleSign: () => void;
  setKeyset: (k: Keyset) => void;
}

const CalcContext = createContext<CalcContextValue | null>(null);

export const CalcProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('0');
  const [keyset, setKeyset] = useState<Keyset>('basic');

  const appendToExpression = useCallback((val: string) => {
    setExpression(prev => {
      const next = prev + val;
      setResult(evaluate(next));
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setExpression('');
    setResult('0');
  }, []);

  const computeResult = useCallback(() => {
    setExpression(prev => {
      const res = evaluate(prev);
      setResult(res);
      // Seed expression with result for chaining, unless error
      return res === 'Error' ? prev : res;
    });
  }, []);

  const toggleSign = useCallback(() => {
    setExpression(prev => {
      const next = negateLastNumber(prev);
      setResult(evaluate(next));
      return next;
    });
  }, []);

  return (
    <CalcContext.Provider value={{ expression, result, keyset, appendToExpression, clearAll, computeResult, toggleSign, setKeyset }}>
      {children}
    </CalcContext.Provider>
  );
};

export function useCalc(): CalcContextValue {
  const ctx = useContext(CalcContext);
  if (!ctx) throw new Error('useCalc must be used inside CalcProvider');
  return ctx;
}
```

---

### Task 4: CalcScreen (`apps/issiecalc/src/screens/CalcScreen.tsx`)

**Files:**
- Create: `apps/issiecalc/src/screens/CalcScreen.tsx`

**Interfaces:**
- Consumes:
  - `useCalc()` from `../context/CalcContext`
  - `KeyboardPreview` from `../../../../src/components/KeyboardPreview` — prop `configJson: string`, event `onKeyPress: (e: KeyPressEvent) => void`, `onHeightChange: (e) => void`
  - `buildKeyboardConfig` from `../../../../src/utils/keyboardConfigMerger`
  - `calc.json` from `../../../../keyboards/calc.json`

- [ ] **Step 1: Create `apps/issiecalc/src/screens/CalcScreen.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardPreview, KeyPressEvent } from '../../../../src/components/KeyboardPreview';
import { buildKeyboardConfig } from '../../../../src/utils/keyboardConfigMerger';
import { useCalc } from '../context/CalcContext';

const calcSource = require('../../../../keyboards/calc.json');

const CalcScreen: React.FC = () => {
  const { expression, result, keyset, appendToExpression, clearAll, computeResult, toggleSign, setKeyset } = useCalc();
  const [configJson, setConfigJson] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(350);
  const insets = useSafeAreaInsets();
  const defaultKbBg = Platform.OS === 'android' ? '#D2D3D9' : '#CBCFD8';

  useEffect(() => {
    const config = buildKeyboardConfig(calcSource, 'calc');
    // Activate the correct keyset
    const modified = {
      ...config,
      initialKeyset: keyset,
    };
    setConfigJson(JSON.stringify(modified));
  }, [keyset]);

  const handleKeyPress = (event: KeyPressEvent) => {
    const { value } = event.nativeEvent;

    if (value === '[SCI]') {
      setKeyset('scientific');
      return;
    }
    if (value === '[BASIC]') {
      setKeyset('basic');
      return;
    }
    if (value === 'C') {
      clearAll();
      return;
    }
    if (value === '=') {
      computeResult();
      return;
    }
    if (value === '+/-') {
      toggleSign();
      return;
    }
    appendToExpression(value);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.display}>
        <Text style={styles.expression} numberOfLines={1} adjustsFontSizeToFit>
          {expression || '0'}
        </Text>
        <Text style={styles.result} numberOfLines={1} adjustsFontSizeToFit>
          {result}
        </Text>
      </View>
      <View style={[styles.keyboardContainer, { paddingBottom: insets.bottom }]}>
        {configJson ? (
          <KeyboardPreview
            style={{ height: keyboardHeight, backgroundColor: defaultKbBg }}
            configJson={configJson}
            hideGlobeButton
            onKeyPress={handleKeyPress}
            onHeightChange={e => setKeyboardHeight(e.nativeEvent.height)}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  display: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  expression: {
    fontSize: 28,
    color: '#8E8E93',
    marginBottom: 8,
  },
  result: {
    fontSize: 64,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  keyboardContainer: {
    backgroundColor: '#CBCFD8',
  },
});

export default CalcScreen;
```

---

### Task 5: App Entry (`apps/issiecalc/App.tsx`, `app.json`, `index.js`)

**Files:**
- Create: `apps/issiecalc/App.tsx`
- Create: `apps/issiecalc/app.json`
- Create: `apps/issiecalc/index.js`

**Interfaces:**
- Consumes: `CalcProvider` from `./src/context/CalcContext`, `CalcScreen` from `./src/screens/CalcScreen`

- [ ] **Step 1: Create `apps/issiecalc/app.json`**

```json
{
  "name": "IssieCalc",
  "displayName": "IssieCalc",
  "version": "1.0.0",
  "buildNumber": "1"
}
```

- [ ] **Step 2: Create `apps/issiecalc/App.tsx`**

```tsx
import React from 'react';
import { Text, TextInput } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CalcProvider } from './src/context/CalcContext';
import CalcScreen from './src/screens/CalcScreen';

(Text as any).defaultProps = { ...((Text as any).defaultProps || {}), allowFontScaling: false };
(TextInput as any).defaultProps = { ...((TextInput as any).defaultProps || {}), allowFontScaling: false };

const App = () => (
  <SafeAreaProvider>
    <CalcProvider>
      <CalcScreen />
    </CalcProvider>
  </SafeAreaProvider>
);

export default App;
```

- [ ] **Step 3: Create `apps/issiecalc/index.js`**

```js
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

---

### Task 6: iOS Target (`ios/IssieCalc/`)

This task requires Xcode. Steps 2–4 are done manually in Xcode; step 1 creates the Info.plist on disk first.

**Files:**
- Create: `ios/IssieCalc/IssieCalc-Info.plist`

- [ ] **Step 1: Create `ios/IssieCalc/IssieCalc-Info.plist`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CADisableMinimumFrameDurationOnPhone</key>
	<true/>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleDisplayName</key>
	<string>IssieCalc</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>org.issieshapiro.IssieCalc</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>IssieCalc</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleSignature</key>
	<string>????</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>ITSAppUsesNonExemptEncryption</key>
	<false/>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key>
		<false/>
		<key>NSAllowsLocalNetworking</key>
		<true/>
	</dict>
	<key>RCTNewArchEnabled</key>
	<true/>
	<key>UIAppFonts</key>
	<array>
		<string>Gveret Levin AlefAlefAlef-Regular.ttf</string>
		<string>AntDesign.ttf</string>
		<string>Ionicons.ttf</string>
		<string>MaterialIcons.ttf</string>
		<string>MaterialDesignIcons.ttf</string>
	</array>
	<key>UILaunchStoryboardName</key>
	<string>LaunchScreen</string>
	<key>UIRequiredDeviceCapabilities</key>
	<array>
		<string>arm64</string>
	</array>
	<key>UIRequiresFullScreen</key>
	<true/>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationPortraitUpsideDown</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
	<key>UIViewControllerBasedStatusBarAppearance</key>
	<false/>
</dict>
</plist>
```

- [ ] **Step 2: Add Xcode target manually**

In Xcode (`IssieBoardNG.xcodeproj`):
1. File → New → Target → iOS App → Next
2. Product Name: `IssieCalc`
3. Bundle Identifier: `org.issieshapiro.IssieCalc`
4. Language: Swift, Interface: Storyboard → Finish
5. Delete the auto-generated Swift files (keep the target shell)
6. Replace the auto-generated `Info.plist` with the one created in Step 1 (or update the target's Info.plist path in Build Settings → `INFOPLIST_FILE` → `ios/IssieCalc/IssieCalc-Info.plist`)

- [ ] **Step 3: Configure the target to use the RN bundle**

In `IssieCalc` target Build Settings:
- Copy build phase settings from `IssieVoice` target (Bundle React Native code and images)
- In the Run Script phase (Bundle React Native), set entry file: `apps/issiecalc/index.js`
- Add the same resource files as IssieVoice (fonts, launch screen)

The easiest way: duplicate the `IssieVoice` target in Xcode, rename to `IssieCalc`, update bundle ID and Info.plist path, update the entry file in the bundle script.

- [ ] **Step 4: Verify target builds**

Select the `IssieCalc` scheme in Xcode, build for a simulator. Expected: app launches showing the calculator display and keyboard.
