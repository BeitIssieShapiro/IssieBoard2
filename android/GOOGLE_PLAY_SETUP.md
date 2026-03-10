# Google Play API Setup Guide

This guide explains how to set up Google Play API access for automated deployment of IssieBoard and IssieVoice to the Google Play Store.

## Overview

Fastlane uses the Google Play Developer API to upload app bundles and manage releases. To enable this, you need to:

1. Create a Google Cloud service account
2. Grant it access to your Google Play Console
3. Download the service account JSON key

The JSON key file should be saved as `android/fastlane/release-admin-creds.json`.

## Prerequisites

- A Google Play Developer account
- Admin or Owner role in your Google Play Console
- Both apps (IssieBoard and IssieVoice) created in Google Play Console

## Step-by-Step Setup

### 1. Access Google Play Console API Settings

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app (or any app if you have multiple)
3. Navigate to **Setup** → **API access** (in the left sidebar)

### 2. Link or Create Google Cloud Project

If you don't already have a linked Google Cloud project:

1. Click **Link a Google Cloud project**
2. Choose to either:
   - **Link existing project** (if you have one)
   - **Create a new project** (recommended for first-time setup)
3. Follow the prompts to complete linking

### 3. Create Service Account

1. On the API access page, scroll to **Service accounts**
2. Click **Create new service account**
3. You'll be redirected to Google Cloud Console
4. In Google Cloud Console:
   - Click **+ CREATE SERVICE ACCOUNT**
   - Enter a name (e.g., "IssieBoard Fastlane Deploy")
   - Enter a description (e.g., "Service account for automated deployment via Fastlane")
   - Click **CREATE AND CONTINUE**
5. Grant the service account the **Service Account User** role:
   - In the "Grant this service account access to project" step
   - Click **Select a role** dropdown
   - Search for "Service Account User"
   - Select it and click **CONTINUE**
6. Skip the optional "Grant users access to this service account" step
7. Click **DONE**

### 4. Create and Download JSON Key

1. In the Service accounts list, find the account you just created
2. Click on the service account email to open its details
3. Go to the **KEYS** tab
4. Click **ADD KEY** → **Create new key**
5. Select **JSON** as the key type
6. Click **CREATE**
7. The JSON key file will download automatically
8. **Important:** Rename this file to `release-admin-creds.json`

### 5. Grant Play Console Access

1. Return to the Google Play Console → **Setup** → **API access** page
2. Scroll to **Service accounts**
3. Find your newly created service account in the list
4. Click **Grant access** next to it
5. On the permissions page:
   - **Account permissions:** Select **Admin** (View app information and download bulk reports)
   - **App permissions:**
     - Click **Add app**
     - Select **IssieBoard** from the list
     - Grant **Release manager** role (or Admin if you need more control)
     - Click **Apply**
     - Repeat for **IssieVoice**
6. Click **Invite user** (or **Save** depending on the UI)

### 6. Place JSON Key File

1. Copy the `release-admin-creds.json` file you downloaded
2. Place it in: `android/fastlane/release-admin-creds.json`
3. Verify the path is correct:
   ```bash
   ls -la android/fastlane/release-admin-creds.json
   ```

**Security Note:** This file is already gitignored and will NOT be committed to your repository.

### 7. Create App Entries in Play Console

If you haven't already created the app entries:

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Fill in the details for **IssieBoard**:
   - App name: IssieBoard
   - Default language: English (or your preference)
   - App or game: App
   - Free or paid: Free (or Paid)
   - Accept the declarations checkboxes
4. Click **Create app**
5. Repeat for **IssieVoice**

### 8. Initial Manual Upload (Required)

**Important:** Google Play requires at least one manual upload before API access works.

For each app (IssieBoard and IssieVoice):

1. Build a release AAB manually:
   ```bash
   cd android
   ./gradlew bundleIssieboardRelease  # or bundleIssievoiceRelease
   ```

2. The AAB will be at:
   - `android/app/build/outputs/bundle/issieboardRelease/app-issieboard-release.aab`
   - `android/app/build/outputs/bundle/issievoiceRelease/app-issievoice-release.aab`

3. In Google Play Console:
   - Go to the app
   - Navigate to **Release** → **Testing** → **Internal testing**
   - Click **Create new release**
   - Upload the AAB file
   - Fill in release notes (can be simple like "Initial release")
   - Click **Save** and then **Review release**
   - Click **Start rollout to Internal testing**

4. Once uploaded successfully, API access will be enabled for that app

## Verification

Test that your setup works:

```bash
cd android
bundle exec fastlane run validate_play_store_json_key \
  json_key:./fastlane/release-admin-creds.json \
  package_name:org.issieshapiro.issieboard
```

If successful, you'll see a message confirming the JSON key is valid.

## Troubleshooting

### "The current user has insufficient permissions"

- Make sure you granted **Release manager** role (or Admin) in Play Console
- Ensure you granted access to the specific apps (IssieBoard and IssieVoice)
- Wait a few minutes for permissions to propagate

### "The app could not be found"

- Verify the app exists in Play Console
- Check that the package name matches exactly:
  - `org.issieshapiro.issieboard`
  - `org.issieshapiro.issievoice`
- Ensure you've completed at least one manual upload

### "No releases found"

- You must upload at least one release manually before API access works
- Follow Step 8 above to do the initial manual upload

### "Invalid JSON key file"

- Verify the file is at `android/fastlane/google-play-key.json`
- Ensure the file is valid JSON (open it in a text editor to check)
- Make sure you downloaded the entire file (not truncated)
- Try re-downloading the key from Google Cloud Console

## CI/CD Setup (Optional)

For GitHub Actions or other CI/CD systems:

1. **Do NOT commit** `release-admin-creds.json` to your repository
2. Store the JSON content as a secret in your CI/CD system:
   - GitHub Actions: Store as repository secret `GOOGLE_PLAY_JSON_KEY`
   - GitLab CI: Store as masked variable
3. In your CI workflow, write the secret to the file:
   ```bash
   echo "$GOOGLE_PLAY_JSON_KEY" > android/fastlane/release-admin-creds.json
   ```

## Next Steps

Once setup is complete, you can deploy using:

```bash
npm run deploy:android:issieboard
npm run deploy:android:issievoice
```

See `android/RELEASE_GUIDE.md` for full deployment instructions.
