# iOS deployment

Fastlane builds signed Release archives and uploads them to TestFlight. Same approach as IssieDocs, extended to the three apps built from this project.

| App | Scheme | Bundle ID | Embedded extensions |
| --- | --- | --- | --- |
| IssieBoard | `IssieBoardNG` | `com.issieshapiro.Issieboard` | `.IssieBoardEn`, `.IssieBoardHe`, `.IssieBoardAr` |
| IssieVoice | `IssieVoice` | `org.issieshapiro.IssieVoice` | – |
| IssieCalc | `IssieCalc` | `com.issieshapiro.IssieCalc` | – |

Apple team `SKNJT9TD9G`, workspace `ios/IssieBoardNG.xcworkspace`.

## Setup

Use macOS with full Xcode, Node.js and Ruby 3.2 or newer (the wrapper prefers Homebrew Ruby). Install JavaScript dependencies with `npm ci`. The command installs Fastlane and CocoaPods from `ios/Gemfile.lock` into `vendor/bundle/ios`.

The root `.env` (ignored by Git) holds the App Store Connect API key settings. The team key is shared by the Issie apps and lives in `issie-shared`, outside this repository:

```dotenv
APPLE_TEAM_ID=SKNJT9TD9G
ASC_KEY_ID=56R6456V33
ASC_ISSUER_ID=<issuer id>
ASC_KEY_PATH=/Users/I022021/dev/Issie/issie-shared/AuthKey_56R6456V33.p8
```

Exported environment variables take precedence over `.env`.

## Commands

Check configuration and App Store Connect access (read-only):

```sh
npm run deploy:ios -- check
```

Build and upload all three apps, or one:

```sh
npm run deploy:ios
npm run deploy:ios:issieboard
npm run deploy:ios:issievoice
npm run deploy:ios:issiecalc
```

Several apps: `npm run deploy:ios -- beta app:issievoice,issiecalc`.

## Versions and build numbers

The marketing version comes from each app target's Release settings. To use another version for one app's archive, set `IOS_VERSION` (only with a single app):

```sh
IOS_VERSION=2.2 npm run deploy:ios:issieboard
```

The build number is one greater than the larger of the local build number and the latest TestFlight build for that version. Version and build number are passed on the `xcodebuild` command line, so they apply to every target in the archive: IssieBoard's keyboard extensions always get the app's version and build, whatever their own project settings say.

Fastlane obtains a distribution certificate and a provisioning profile for each bundle ID (IssieBoard needs four: the app and its three keyboards), applies manual signing to the Release configuration of those targets, archives, and uploads `ios/build/<App>.ipa`. The signing changes are restored after archiving, including on failure. The command finishes after upload; Apple's processing status appears in App Store Connect under TestFlight.

## Tests

```sh
npm run deploy:ios -- test
```

The tests evaluate the real lane definitions against a temporary copy of the Xcode project, with signing, build and Apple API actions stubbed. A real archive and upload are needed to validate signing end to end.
