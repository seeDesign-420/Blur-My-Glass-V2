# Technology Stack

> Mapped: 2026-04-26 (refreshed — reflects Phase 1+2 changes)

## Overview

**blur-my-glass** is an Arch Linux PKGBUILD project that patches and recompiles GNOME Shell 50.0 to add custom blur effects (anti-aliased rounded corner masking and liquid glass refraction) to the Mutter compositor's `ShellBlurEffect`. It uses a stacked patch architecture where a base patch is always applied and an optional overlay patch adds advanced effects.

## Languages

| Language | Role | Files |
|----------|------|-------|
| **C** | Core patch target — `shell-blur-effect.c` / `.h` | Base: ~300 LOC changes, Overlay: ~250 LOC changes |
| **GLSL** | Inline shader strings embedded in C | SDF mask, refraction lens, specular lighting fragments |
| **Bash** | Installer script, PKGBUILD | `install.sh`, `PKGBUILD` |
| **Meson** | Build system (upstream GNOME Shell) | `src/gnome-shell/meson.build` (367 lines) |

## Runtime

- **Target OS:** Arch Linux (or derivatives like CachyOS, EndeavourOS, Manjaro)
- **Desktop:** GNOME 50 on Wayland
- **Compositor:** Mutter 50 (libmutter-18 API)
- **Package manager:** pacman / makepkg
- **Shell runtime:** GJS (GNOME JavaScript) for shell UI logic

## Build System

### PKGBUILD (`PKGBUILD`)
- Package name: `gnome-shell-rounded-blur` (provides/conflicts `gnome-shell`)
- Source: upstream GNOME Shell 50.0 from `gitlab.gnome.org/GNOME/gnome-shell.git`
- Subprojects: `libgnome-volume-control`, `jasmine-gjs`, `libshew`
- Build: `arch-meson` → `meson compile -C build`
- **Stacked patching:** base always applied; overlay applied when `BLUR_PATCH=liquid_glass_compositor`

### Compiler flags
```
CFLAGS: -O3 -fno-semantic-interposition
LDFLAGS: -Wl,-Bsymbolic-functions
```

## Dependencies

### Build dependencies (makedepends)
- `asciidoc`, `bash-completion`, `evolution-data-server`
- `gi-docgen`, `git`, `glib2-devel`
- `gnome-keybindings`, `gobject-introspection`
- `meson`, `python-docutils`, `sassc`

### Runtime dependencies (key ones)
- `mutter` (libmutter-18.so) — the compositor we're patching against
- `gjs` — JavaScript runtime for GNOME Shell
- `gtk4`, `libadwaita` — UI toolkit
- `cairo`, `pango`, `graphene` — rendering primitives
- `libglvnd` — OpenGL dispatch (for GLSL shaders)
- `libpipewire` — screen recording support

## Configuration

### Patch variants (stacked at build time)
| Layer | Applied | Env var | Patch file |
|-------|---------|---------|------------|
| Base | Always | (default) | `patches/rounded_corners_mask.patch` (313 lines) |
| Overlay | Opt-in | `BLUR_PATCH=liquid_glass_compositor` | `patches/liquid_glass_compositor.patch` (253 lines) |

### GObject properties added to `ShellBlurEffect`
| Property | Type | Range | Layer |
|----------|------|-------|-------|
| `corner-radius` | float | 0 → ∞ | Base |
| `refraction-strength` | float | 0 → 2 | Overlay |

## Key Directories

| Path | Purpose |
|------|---------|
| `patches/` | Maintained patch files (the project's core deliverable) |
| `PKGBUILD` | Arch Linux package build recipe |
| `install.sh` | User-facing installer script |
| `src/gnome-shell/` | Checked-out upstream GNOME Shell source (gitignored, created by makepkg) |
| `src/build/` | Meson build output (gitignored) |
| `pkg/` | makepkg staging directory (gitignored) |
