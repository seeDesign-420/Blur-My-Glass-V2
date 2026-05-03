#!/usr/bin/env bash
set -e

EXT_DIR="$HOME/.local/share/gnome-shell/extensions/blur-my-shell@aunetx"
COMP_DIR="$EXT_DIR/components"
SRC="$(dirname "$0")/dhruva.js"

echo "=== Dhruva Blur Deployment ==="

# Verify source exists
if [ ! -f "$SRC" ]; then
    echo "ERROR: $SRC not found"
    exit 1
fi

# Verify extension dir exists
if [ ! -d "$COMP_DIR" ]; then
    echo "ERROR: Extension components dir not found: $COMP_DIR"
    exit 1
fi

# Check if file already exists
if [ -f "$COMP_DIR/dhruva.js" ]; then
    echo "  Existing dhruva.js found, replacing..."
else
    echo "  No dhruva.js found, creating..."
fi

# Copy the file
cp "$SRC" "$COMP_DIR/dhruva.js"
echo "✓ Copied dhruva.js to $COMP_DIR/"

# Verify
if [ -f "$COMP_DIR/dhruva.js" ]; then
    SIZE=$(wc -c < "$COMP_DIR/dhruva.js")
    echo "✓ Verified: $COMP_DIR/dhruva.js ($SIZE bytes)"
else
    echo "ERROR: Copy failed!"
    exit 1
fi

# Compile schemas
if [ -d "$EXT_DIR/schemas" ]; then
    glib-compile-schemas "$EXT_DIR/schemas/" 2>/dev/null && echo "✓ Schemas compiled" || echo "⚠ Schema compilation skipped"
fi

echo ""
echo "Done! Restart GNOME Shell to apply:"
echo "  Wayland: Log out and log back in"
echo "  X11:     Alt+F2 → r → Enter"
