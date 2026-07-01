# Using Shared Fastlane Deployment

This project now uses the shared Fastlane configuration from `issie-shared/android`.

## Quick Start

### Deploy to Google Play

```bash
# Deploy IssieBoard
npm run deploy:android:issieboard

# Deploy IssieVoice
npm run deploy:android:issievoice
```

## What Happens

1. ✅ Checks git status is clean
2. 📈 Increments version code in `android/version.properties`
3. 🔨 Builds release AAB bundle
4. ☁️ Uploads to Google Play Internal Track as **DRAFT**
5. 💾 Commits version bump

## Architecture

```
IssieBoardNG/
├── scripts/deploy-android.sh       # Calls shared Fastlane with parameters
└── android/version.properties      # Project-specific version tracking

issie-shared/android/
├── fastlane/
│   ├── Fastfile                    # Generic deployment lanes (SHARED)
│   └── release-admin-creds.json    # Google Play API credentials (SHARED)
└── Gemfile                         # Ruby dependencies (SHARED)
```

## Benefits

✅ **No code duplication**: Single deployment implementation
✅ **Shared credentials**: One set of keys for all Issie projects
✅ **Easy maintenance**: Update once, applies everywhere
✅ **Consistent process**: Same workflow across all apps

## Troubleshooting

**Missing credentials:**
```bash
# Ensure credentials exist in shared location
ls ../issie-shared/android/fastlane/release-admin-creds.json
```

**Ruby/Fastlane not installed:**
```bash
cd ../issie-shared/android
bundle install
```

**Version conflict:**
- Check `android/version.properties` for correct project entries
- Ensure flavor names match (issieboard, issievoice)

## Manual Fastlane Call

If you need to call Fastlane directly:

```bash
cd ../issie-shared/android
bundle exec fastlane deploy_android \
  project_root:/Users/i022021/dev/Issie/IssieBoardNG \
  project_name:issieboard \
  package_name:org.issieshapiro.issieboard \
  flavor:issieboard
```

## Adding New Flavors

To add a new app/flavor:

1. Add entry to `android/version.properties`:
   ```properties
   myapp.versionCode=1
   myapp.versionName=1.0
   ```

2. Update `scripts/deploy-android.sh` with package name

3. Add npm script to `package.json`:
   ```json
   "deploy:android:myapp": "scripts/deploy-android.sh myapp"
   ```

That's it! The shared Fastlane handles everything else.
