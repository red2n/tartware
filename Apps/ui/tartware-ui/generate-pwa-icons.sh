#!/bin/bash

# PWA Icon Generator Script
# Generates all required PWA icons from a source image
# Requires ImageMagick: sudo apt install imagemagick

SOURCE_IMAGE="$1"
OUTPUT_DIR="public/assets/icons"

if [ -z "$SOURCE_IMAGE" ]; then
    echo "Usage: ./generate-pwa-icons.sh <source-image.png>"
    echo "Example: ./generate-pwa-icons.sh logo.png"
    exit 1
fi

if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Error: Source image '$SOURCE_IMAGE' not found"
    exit 1
fi

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed"
    echo "Install it with: sudo apt install imagemagick"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Generate icons
echo "Generating PWA icons..."

sizes=(72 96 128 144 152 192 384 512)

for size in "${sizes[@]}"; do
    echo "Generating ${size}x${size}..."
    convert "$SOURCE_IMAGE" -resize "${size}x${size}" "$OUTPUT_DIR/icon-${size}x${size}.png"
done

echo "✓ All icons generated successfully in $OUTPUT_DIR"
echo ""
echo "Icons created:"
ls -lh "$OUTPUT_DIR"
