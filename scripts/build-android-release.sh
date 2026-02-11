#!/bin/bash

# IssieBoard Android Release Build Script
# This script builds a signed Android App Bundle (.aab) ready for Google Play upload

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}IssieBoard Android Release Build${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if we're in the project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from project root directory${NC}"
    exit 1
fi

# Check if gradle.properties exists
if [ ! -f "android/gradle.properties" ]; then
    echo -e "${YELLOW}Warning: android/gradle.properties not found!${NC}"
    echo -e "${YELLOW}Copying from gradle.properties.example...${NC}"
    cp android/gradle.properties.example android/gradle.properties
    echo -e "${RED}Please edit android/gradle.properties with your keystore details!${NC}"
    exit 1
fi

# Check if keystore file exists
KEYSTORE_FILE=$(grep "ISSIE_UPLOAD_STORE_FILE" android/gradle.properties | cut -d'=' -f2)
if [ ! -f "android/app/$KEYSTORE_FILE" ]; then
    echo -e "${RED}Error: Keystore file not found: android/app/$KEYSTORE_FILE${NC}"
    echo ""
    echo -e "${YELLOW}Option 1 - Use shared keystore from IssieDice:${NC}"
    echo -e "  cp ../IssieDice/uploadkeystore.jks android/app/uploadkeystore.jks"
    echo ""
    echo -e "${YELLOW}Option 2 - Generate a new keystore:${NC}"
    echo -e "  keytool -genkeypair -v -storetype PKCS12 -keystore android/app/issieboard-release.keystore -alias issieboardng -keyalg RSA -keysize 2048 -validity 10000"
    exit 1
fi

# Get version info
VERSION_CODE=$(grep "versionCode" android/app/build.gradle | grep -o '[0-9]\+' | head -1)
VERSION_NAME=$(grep "versionName" android/app/build.gradle | grep -o '"[^"]*"' | head -1 | tr -d '"')

echo -e "${GREEN}Building version: $VERSION_NAME (code: $VERSION_CODE)${NC}"
echo ""

# Step 1: Install dependencies
echo -e "${BLUE}Step 1: Installing npm dependencies...${NC}"
npm install
echo ""

# Step 2: Clean previous builds
echo -e "${BLUE}Step 2: Cleaning previous builds...${NC}"
cd android
./gradlew clean
cd ..
echo ""

# Step 3: Build the release bundle
echo -e "${BLUE}Step 3: Building release bundle (.aab)...${NC}"
cd android
./gradlew bundleRelease
cd ..
echo ""

# Step 4: Find the output file
AAB_FILE="android/app/build/outputs/bundle/release/app-release.aab"
if [ ! -f "$AAB_FILE" ]; then
    echo -e "${RED}Error: Bundle file not found at $AAB_FILE${NC}"
    exit 1
fi

# Get file size
FILE_SIZE=$(du -h "$AAB_FILE" | cut -f1)

# Create release directory if it doesn't exist
mkdir -p releases

# Copy to releases directory with version name
RELEASE_FILE="releases/IssieBoard-v${VERSION_NAME}-${VERSION_CODE}.aab"
cp "$AAB_FILE" "$RELEASE_FILE"

echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ Build successful!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${GREEN}Output file: ${RELEASE_FILE}${NC}"
echo -e "${GREEN}File size: ${FILE_SIZE}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Test the bundle locally:"
echo -e "   bundletool build-apks --bundle=${RELEASE_FILE} --output=app.apks --mode=universal"
echo -e "2. Upload to Google Play Console:"
echo -e "   https://play.google.com/console"
echo -e "3. Or use the deploy script:"
echo -e "   ./scripts/deploy-android.sh"
echo ""