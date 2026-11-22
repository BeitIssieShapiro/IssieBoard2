# IssieVoice Xcode Target Setup Guide

## Architecture Overview

IssieVoice runs in the **same Xcode project** as IssieBoard, but as a **separate target**. The apps share:
- Same Swift AppDelegate
- Same React Native infrastructure
- Same dependencies (Pods)

But they load **different React Native apps** based on the bundle identifier.

## How It Works

```
┌─────────────────────────────────────────┐
│  AppDelegate.swift (Swift)              │
│  ↓                                      │
│  Checks Bundle ID                       │
│  ├─ org.issieshapiro.issieboard        │
│  │  → moduleName = "IssieBoardNG"      │
│  │  → Loads: App.tsx                   │
│  │                                      │
│  └─ org.issieshapiro.issievoice        │
│     → moduleName = "IssieVoice"        │
│     → Loads: apps/issievoice/App.tsx   │
└─────────────────────────────────────────┘
```

## Step 1: Add IssieVoice Target in Xcode

### 1.1 Open the Project
```bash
cd ios
open IssieBoardNG.xcworkspace
```

### 1.2 Add New Target
1. In Xcode, select the **IssieBoardNG** project in the navigator
2. Click the **+** button at the bottom of the targets list
3. Choose **iOS** → **App**
4. Click **Next**

### 1.3 Configure Target
- **Product Name**: `IssieVoice`
- **Team**: (Your development team)
- **Organization Identifier**: `org.issieshapiro`
- **Bundle Identifier**: `org.issieshapiro.issievoice`
- **Language**: Swift
- **User Interface**: Storyboard (we'll remove this later)
- **Include Tests**: No (optional)

### 1.4 Important: Choose Correct Location
- When prompted, **Add to**: IssieBoardNG project
- **Group**: IssieBoardNG (or create "IssieVoice" folder)

## Step 2: Configure IssieVoice Target

### 2.1 General Settings
1. Select **IssieVoice** target
2. **General** tab:
   - **Display Name**: IssieVoice
   - **Bundle Identifier**: `org.issieshapiro.issievoice`
   - **Version**: 1.0
   - **Build**: 1
   - **Deployment Target**: iOS 14.0 (or higher)

### 2.2 Remove Auto-Generated Files
Xcode created some files we don't need:
1. Delete `IssieVoice` folder (if created)
2. We'll use shared AppDelegate and React Native

### 2.3 Add AppDelegate to Target
1. Select `IssieBoardNG/AppDelegate.swift` in navigator
2. In **File Inspector** (right panel):
   - Check **Target Membership**
   - Enable both: `IssieBoardNG` ✓ and `IssieVoice` ✓

### 2.4 Info.plist
Create `ios/IssieVoice-Info.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleDisplayName</key>
	<string>IssieVoice</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>$(PRODUCT_NAME)</string>
	<key>CFBundlePackageType</key>
	<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
	<key>CFBundleVersion</key>
	<string>$(CURRENT_PROJECT_VERSION)</string>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>UILaunchStoryboardName</key>
	<string>LaunchScreen</string>
	<key>UIRequiredDeviceCapabilities</key>
	<array>
		<string>armv7</string>
	</array>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
	<key>UIViewControllerBasedStatusBarAppearance</key>
	<false/>
	<key>UIAppFonts</key>
	<array>
		<!-- Add custom fonts here if needed -->
	</array>
</dict>
</plist>
```

### 2.5 Build Settings
1. Select **IssieVoice** target
2. **Build Settings** tab:
   - Search for "Info.plist"
   - Set **Info.plist File**: `IssieVoice-Info.plist`

### 2.6 Share LaunchScreen
1. Select `IssieBoardNG/LaunchScreen.storyboard`
2. In **File Inspector**:
   - Enable both targets: `IssieBoardNG` ✓ and `IssieVoice` ✓

### 2.7 Copy Build Phases from IssieBoardNG
The IssieVoice target needs the same build phases:

1. **Start Packager** (Run Script Phase):
```bash
export RCT_METRO_PORT="${RCT_METRO_PORT:=8081}"
echo "export RCT_METRO_PORT=${RCT_METRO_PORT}" > "${SRCROOT}/../node_modules/react-native/scripts/.packager.env"
if [ -z "${RCT_NO_LAUNCH_PACKAGER+xxx}" ] ; then
  if nc -w 5 -z localhost ${RCT_METRO_PORT} ; then
    if ! curl -s "http://localhost:${RCT_METRO_PORT}/status" | grep -q "packager-status:running" ; then
      echo "Port ${RCT_METRO_PORT} already in use, packager is either not running or not running correctly"
      exit 2
    fi
  else
    open "$SRCROOT/../node_modules/react-native/scripts/launchPackager.command" || echo "Can't start packager automatically"
  fi
fi
```

2. **Bundle React Native code and images** (Run Script Phase):
```bash
set -e

WITH_ENVIRONMENT="../node_modules/react-native/scripts/xcode/with-environment.sh"
REACT_NATIVE_XCODE="../node_modules/react-native/scripts/react-native-xcode.sh"

/bin/sh -c "$WITH_ENVIRONMENT $REACT_NATIVE_XCODE"
```

## Step 3: App Icons and Assets

### 3.1 Create App Icon Set
1. In Xcode, create new Asset Catalog: `IssieVoice.xcassets`
2. Add `AppIcon` image set
3. Add icon images (1024x1024 for App Store, etc.)

### 3.2 Set App Icon
1. Select **IssieVoice** target
2. **General** tab → **App Icons and Launch Screen**
3. **App Icon**: Select `IssieVoice/AppIcon`

## Step 4: Scheme Configuration

### 4.1 Edit IssieVoice Scheme
1. **Product** menu → **Scheme** → **Manage Schemes**
2. Find **IssieVoice** scheme
3. Click **Edit**

### 4.2 Configure Build
1. **Build** section:
   - Ensure **IssieVoice** target is selected
   - Remove any keyboard extension targets

### 4.3 Configure Run
1. **Run** section:
   - **Build Configuration**: Debug
   - **Executable**: IssieVoice.app

## Step 5: Pod Dependencies

The Podfile already supports multiple targets. Run:

```bash
cd ios
pod install
```

## Step 6: Test Build

### 6.1 Select Scheme
In Xcode toolbar:
- Select **IssieVoice** scheme
- Select simulator or device

### 6.2 Build and Run
1. Press **⌘ + R** (or click Play button)
2. App should launch with IssieVoice UI

## How to Switch Between Apps

### From Terminal:
```bash
# Run IssieBoard
npm run ios

# Run IssieVoice
npm run ios -- --scheme IssieVoice
```

### From Xcode:
1. Select scheme from dropdown (IssieBoard or IssieVoice)
2. Press ⌘ + R

## Troubleshooting

### Issue: "Module not found"
**Solution**: Run `pod install` in ios/ directory

### Issue: Wrong app launches
**Solution**: Check bundle identifier in target settings

### Issue: Build fails
**Solution**: 
1. Clean build folder (⌘ + Shift + K)
2. Delete DerivedData
3. Run `pod install` again

### Issue: Metro bundler doesn't start
**Solution**: 
1. Kill existing Metro: `pkill -f metro`
2. Start fresh: `npm start -- --reset-cache`

## File Structure Summary

```
IssieBoardNG/
├── ios/
│   ├── IssieBoardNG.xcodeproj/     # Contains BOTH targets
│   ├── IssieBoardNG/
│   │   ├── AppDelegate.swift       # Shared by both
│   │   └── Info.plist             # IssieBoard config
│   ├── IssieVoice-Info.plist      # IssieVoice config
│   ├── Podfile                     # Shared dependencies
│   └── Pods/
├── App.tsx                         # IssieBoard app
├── apps/issievoice/
│   └── App.tsx                     # IssieVoice app
└── index.js                        # Routes to correct app
```

## Next Steps

1. Customize IssieVoice app icon
2. Configure app capabilities (if needed)
3. Test on device
4. Configure code signing
5. Prepare for TestFlight/App Store

---

**Created**: February 11, 2026  
**Last Updated**: February 11, 2026  
**Target Structure**: Same project, separate targets