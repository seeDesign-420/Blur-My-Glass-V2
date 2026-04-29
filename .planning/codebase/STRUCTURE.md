# Directory Structure

## Root Level
- `PKGBUILD`: Arch Linux package definition.
- `install.sh`: Installer script handling patch selection and build cleanup.
- `patches/`: Contains the C patches applied to upstream code.

## Patches
- `patches/rounded_corners_mask.patch`: The base patch for anti-aliased rounded corners.
- `patches/liquid_glass_compositor.patch`: The overlay patch for liquid glass refraction.

## Upstream Source (Ignored/Transient)
- `gnome-shell/`: Cloned upstream repository (present after build).
- `pkg/`, `src/`: Standard `makepkg` directories.

*(Generated on 2026-04-29)*
