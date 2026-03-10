#!/bin/bash
set -e

FLAVOR=$1

if [ -z "$FLAVOR" ]; then
  echo "Usage: ./scripts/deploy-android.sh [issieboard|issievoice]"
  exit 1
fi

if [ "$FLAVOR" != "issieboard" ] && [ "$FLAVOR" != "issievoice" ]; then
  echo "Error: Flavor must be 'issieboard' or 'issievoice'"
  exit 1
fi

echo "🚀 Deploying $FLAVOR to Google Play Internal Track..."

# Check for credentials
if [ ! -f "android/fastlane/release-admin-creds.json" ]; then
  echo "❌ Error: release-admin-creds.json not found"
  echo "Please follow android/GOOGLE_PLAY_SETUP.md to configure API access"
  exit 1
fi

# Check for signing config
if [ ! -f "android/gradle.properties" ]; then
  echo "❌ Error: android/gradle.properties not found"
  echo "Please copy android/gradle.properties.example and configure signing"
  exit 1
fi

# Check for upload keystore
if [ ! -f "android/app/uploadkeystore.jks" ]; then
  echo "❌ Error: android/app/uploadkeystore.jks not found"
  echo "Please ensure upload keystore is present"
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run fastlane
echo "🔨 Building and deploying..."
cd android
bundle exec fastlane deploy_${FLAVOR}

echo "✅ Deployment complete!"
