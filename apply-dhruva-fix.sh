#!/usr/bin/env bash

set -e

echo "Applying Dhruva Dock Blur Fix..."

EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/blur-my-shell@aunetx"
COMPONENTS_DIR="$EXTENSION_DIR/components"
SCHEMAS_DIR="$EXTENSION_DIR/schemas"

# Check if extension is installed
if [ ! -d "$EXTENSION_DIR" ]; then
    echo "Error: blur-my-shell extension not found at $EXTENSION_DIR"
    exit 1
fi

# Copy the updated dhruva.js
echo "Copying updated dhruva.js to $COMPONENTS_DIR/"
cp dhruva.js "$COMPONENTS_DIR/dhruva.js"

# Compile GSettings schemas
echo "Compiling GSettings schemas in $SCHEMAS_DIR/"
glib-compile-schemas "$SCHEMAS_DIR/"

echo ""
echo "Fix applied successfully!"
echo "Please restart GNOME Shell to see the changes:"
echo " - On X11: Alt+F2, type 'r', press Enter"
echo " - On Wayland: Log out and log back in"
