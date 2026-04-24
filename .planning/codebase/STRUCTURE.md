# Directory Structure

> Mapped: 2026-04-24

## Project Root

```
blur-my-glass-live/
├── .git/                          # Git repository
├── .gitignore                     # Excludes build artifacts, src/, pkg/
├── .scratch/                      # Development scratch space
│   ├── patchwork/                 #   Patch development workspace
│   └── upstream_test/             #   Upstream testing workspace
├── PKGBUILD                       # ★ Arch Linux package build recipe
├── README.md                      # Project documentation
├── install.sh                     # ★ User-facing installer script
├── patches/                       # ★ CORE DELIVERABLE
│   ├── rounded_corners_mask.patch #   Stable: SDF rounded corners (322 lines)
│   └── liquid_glass_compositor.patch # Experimental: full glass pipeline (1656 lines)
│
├── gnome-shell/                   # [gitignored] Bare git clone of upstream
├── libgnome-volume-control/       # [gitignored] Subproject source
├── jasmine-gjs/                   # [gitignored] Subproject source
├── libshew/                       # [gitignored] Subproject source
│
├── src/                           # [gitignored] makepkg source directory
│   ├── gnome-shell/               #   Full GNOME Shell source tree (post-patch)
│   │   ├── meson.build            #   Root build definition (367 lines)
│   │   ├── src/                   #   C source files
│   │   │   ├── shell-blur-effect.c  # ★ Primary patch target (39KB patched)
│   │   │   ├── shell-blur-effect.h  # ★ Header with new API declarations
│   │   │   ├── shell-global.c       #   Global singleton
│   │   │   ├── shell-glsl-effect.c  #   GLSL effect base class
│   │   │   └── ... (77 more files)
│   │   ├── js/                    #   GNOME Shell JavaScript
│   │   │   ├── ui/                #   Shell UI modules
│   │   │   ├── misc/              #   Utility modules
│   │   │   └── gdm/               #   Login manager integration
│   │   ├── data/                  #   GSettings schemas, desktop files
│   │   ├── tests/                 #   Shell tests (jasmine-gjs based)
│   │   └── docs/                  #   API documentation sources
│   ├── build/                     #   Meson build output
│   │   ├── build.ninja            #   Generated ninja build file
│   │   ├── compile_commands.json  #   Compilation database (270KB)
│   │   └── config.h               #   Generated configuration header
│   ├── liquid_glass_compositor.patch  # Copy of selected patch (placed by prepare())
│   └── rounded_corners_mask.patch     # Copy of selected patch
│
├── pkg/                           # [gitignored] makepkg packaging output
│   ├── gnome-shell-blur-my-glass/
│   └── gnome-shell-blur-my-glass-docs/
│
├── *.pkg.tar.zst                  # [gitignored] Built package archives
└── .planning/                     # GSD planning documents
    └── codebase/                  #   This codebase map
```

## Key Locations

### Tracked Files (3 core files + 2 patches = 5 files total)

| File | Lines | Purpose |
|------|-------|---------|
| `PKGBUILD` | 163 | Package build recipe — sources, deps, prepare/build/package functions |
| `install.sh` | 118 | User-facing installer with arg parsing, preflight checks, dependency install |
| `README.md` | 90 | Project documentation |
| `patches/rounded_corners_mask.patch` | 322 | Stable patch: SDF corner radius mask |
| `patches/liquid_glass_compositor.patch` | 1656 | Experimental patch: full liquid glass material pipeline |

### Primary Patch Target

| File | Description |
|------|-------------|
| `src/gnome-shell/src/shell-blur-effect.c` | Multi-pass blur effect implementation — FBO management, GLSL snippets, GObject properties |
| `src/gnome-shell/src/shell-blur-effect.h` | Public API header — getter/setter declarations for new properties |

## Naming Conventions

- **Patch files:** `snake_case.patch` matching `BLUR_PATCH` env var values
- **C files:** `shell-{feature}.c` / `.h` (GNOME Shell convention, kebab-case)
- **Package name:** `gnome-shell-rounded-blur` (hyphenated)
- **GObject properties:** kebab-case (`corner-radius`, `refraction-strength`)
- **GLSL uniforms:** `u_` prefix (`u_corner_radius`, `u_size`, `u_refract_size`)

## File Ownership

| Owner | Files |
|-------|-------|
| **This project** | `PKGBUILD`, `install.sh`, `README.md`, `patches/*`, `.gitignore` |
| **Upstream GNOME** | Everything under `src/gnome-shell/` (cloned at build time) |
| **makepkg** | `src/`, `pkg/`, `*.pkg.tar.zst`, `gnome-shell/`, subproject dirs |
