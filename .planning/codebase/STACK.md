# Tech Stack

## Core Technologies
- **Platform:** Arch Linux
- **Environment:** GNOME 50, Wayland
- **Language:** C (for patches), Bash (build/install scripts)
- **Compositor:** Mutter 18 API
- **Graphics API:** Cogl (embedded in Mutter)
- **Shaders:** GLSL

## Packaging & Build
- **Build System:** `makepkg`, `meson` (via upstream gnome-shell)
- **Package Format:** Arch Linux PKGBUILD (`.pkg.tar.zst`)
- **Patch Management:** `patch` utility applied during `prepare()`

## Key Dependencies
- `mutter` (libmutter-18.so)
- `gnome-shell` (upstream source)
- `gobject-introspection`, `glib2`, `gtk4`, `cogl`

*(Generated on 2026-04-29)*
