#!/bin/bash
# Project-specific wrapper for shared deployment script
# This is a thin wrapper that calls the shared deploy.sh with project-specific parameters

set -e

FLAVOR=$1

if [ -z "$FLAVOR" ]; then
  echo "Usage: ./scripts/deploy-android.sh [issieboard|issievoice]"
  exit 1
fi

# Validate flavor
if [ "$FLAVOR" != "issieboard" ] && [ "$FLAVOR" != "issievoice" ]; then
  echo "Error: Flavor must be 'issieboard' or 'issievoice'"
  exit 1
fi

# Determine project root and shared deployment script
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHARED_DEPLOY="$(cd "$(dirname "$0")/../../issie-shared/android" && pwd)/deploy.sh"

# Check if shared deploy script exists
if [ ! -f "$SHARED_DEPLOY" ]; then
  echo "❌ Error: Shared deploy script not found at $SHARED_DEPLOY"
  echo "Please ensure issie-shared repository is checked out at ../issie-shared"
  exit 1
fi

# Map flavor to package name
case $FLAVOR in
  issieboard)
    PACKAGE_NAME="org.issieshapiro.issieboard"
    ;;
  issievoice)
    PACKAGE_NAME="org.issieshapiro.issievoice"
    ;;
esac

# Call shared deployment script
export PROJECT_ROOT
"$SHARED_DEPLOY" "$FLAVOR" "$PACKAGE_NAME" "$FLAVOR"
