#!/bin/bash

# Script to download and setup Duplo binary for code duplication analysis

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DUPLO_PATH="$PROJECT_ROOT/duplo"

echo "Setting up Duplo..."

# Check if duplo already exists
if [ -f "$DUPLO_PATH" ]; then
    echo "✓ Duplo already installed at $DUPLO_PATH"
    exit 0
fi

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Linux*)
        DUPLO_PLATFORM="duplo-linux"
        ;;
    Darwin*)
        DUPLO_PLATFORM="duplo-macos"
        ;;
    *)
        echo "❌ Unsupported OS: $OS"
        echo "Please download Duplo manually from https://github.com/dlidstrom/Duplo/releases"
        exit 1
        ;;
esac

echo "Detected platform: $DUPLO_PLATFORM"
echo "Downloading latest Duplo release..."

# Download the latest release
cd "$PROJECT_ROOT"
curl -s "https://api.github.com/repos/dlidstrom/Duplo/releases/latest" \
    | grep "browser_download_url" \
    | grep "$DUPLO_PLATFORM" \
    | cut -d : -f 2,3 \
    | tr -d '"' \
    | xargs curl -L -o duplo.zip

if [ ! -f duplo.zip ]; then
    echo "❌ Failed to download Duplo"
    exit 1
fi

echo "Extracting..."
unzip -o duplo.zip
chmod +x duplo
rm duplo.zip

echo "✓ Duplo installed successfully at $DUPLO_PATH"
