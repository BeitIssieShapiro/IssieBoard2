#!/bin/bash

# Build Keyboard Configs (iOS and Android)
# This script is called during Xcode build to generate default_config.json files
# from the source keyboard definitions in keyboards/*.json

set -e

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔨 Building keyboard configs..."
echo "   Project root: $PROJECT_ROOT"

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js not found, skipping keyboard config generation"
    echo "   Install Node.js or run 'npm run build:keyboards' manually"
    exit 0
fi

# Run the build script
cd "$PROJECT_ROOT"
node scripts/build_keyboard_configs.js

echo "✅ Keyboard configs generated successfully"
