# Project Structure

*Mapped: 2026-05-03*

## Root Directory

```
blur-my-glass-live/
├── PKGBUILD                          # Arch Linux package definition (167 lines)
├── README.md                         # Project documentation (90 lines)
├── install.sh                        # Build + install script (123 lines)
├── deploy-dhruva.sh                  # Copy dhruva.js to extension dir (51 lines)
├── apply-dhruva-fix.sh               # Quick-deploy dhruva.js + compile schemas (30 lines)
├── dhruva.js                         # Dhruva dock blur component (479 lines) ★
├── .gitignore                        # Excludes build artifacts, source checkouts
├── blur-my-glass-live.code-workspace # VS Code workspace config
│
├── patches/                          # Compositor patches
│   ├── rounded_corners_mask.patch    # Base: SDF AA mask + corner-radius (314 lines)
│   ├── liquid_glass_compositor.patch # Overlay: refraction + specular (250 lines)
│   └── liquid_glass_compositor.patch.tmp  # Scratch/backup
│
├── .planning/                        # GSD project management
│   ├── PROJECT.md                    # Project definition + key decisions
│   ├── REQUIREMENTS.md               # v1.0 requirements
│   ├── ROADMAP.md                    # 6-phase roadmap
│   ├── STATE.md                      # Current project state
│   ├── codebase/                     # This directory (codebase mapping docs)
│   ├── phases/                       # Phase-specific plans + research
│   │   ├── 01-fix-sdf-anti-aliasing/
│   │   ├── 02-stacked-patch-architecture/
│   │   ├── 03-actor-coverage-audit/
│   │   ├── 04-boxpointer-blur/
│   │   └── 06-dhruva-dock-integration/
│   └── debug/                        # Debugging artifacts
│
├── .scratch/                         # Working scratch files
│
├── gnome-shell/                      # Git submodule (bare repo, packed refs)
├── src/                              # makepkg source checkout (gitignored)
├── pkg/                              # makepkg package staging (gitignored)
│   └── gnome-shell-rounded-blur/     # Built package tree
│   └── gnome-shell-rounded-blur-docs/
│
├── jasmine-gjs/                      # Test framework subproject (gitignored)
├── libgnome-volume-control/          # Audio control subproject (gitignored)
├── libshew/                          # Embedded widget subproject (gitignored)
│
├── *.pkg.tar.zst                     # Built packages (gitignored)
└── Screencast *.mp4                  # Debug screencasts
```

## Key Locations

### Source Files (committed)

| File | Lines | Role |
|------|-------|------|
| `dhruva.js` | 479 | **Primary deliverable** — blur-my-shell component for Dhruva dock. Contains `DhruvaBlur` class with dock blur + context menu blur |
| `patches/rounded_corners_mask.patch` | 314 | **Base patch** — SDF mask FBO, corner-radius property, AA smoothstep |
| `patches/liquid_glass_compositor.patch` | 250 | **Overlay patch** — refraction GLSL, specular highlights, refraction-strength property |
| `PKGBUILD` | 167 | Package build recipe with stacked patch logic |
| `install.sh` | 123 | User-facing build/install script with flag parsing |
| `deploy-dhruva.sh` | 51 | Deploy `dhruva.js` to live extension directory |
| `apply-dhruva-fix.sh` | 30 | Quick deploy + schema compile |

### Deployed Extension (runtime, not committed)

| Location | Purpose |
|----------|---------|
| `~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/` | Extension root |
| `...components/dhruva.js` | Deployed Dhruva blur component |
| `...components/boxpointer.js` | BoxPointer blur component (reference architecture) |
| `...components/appfolders.js` | App folders blur component |
| `...conveniences/dummy_pipeline.js` | DummyPipeline utility |
| `...conveniences/effects_manager.js` | GPU effect pool |
| `...conveniences/connections.js` | Signal lifecycle |
| `...conveniences/settings.js` | GSettings wrapper |
| `...conveniences/keys.js` | Component settings keys |
| `...extension.js` | Extension entry point (713 lines) |
| `...schemas/` | GSettings schema XML + compiled |

### Build Output (gitignored)

| Location | Purpose |
|----------|---------|
| `src/gnome-shell/` | Patched GNOME Shell source |
| `src/build/` | Meson build directory |
| `pkg/gnome-shell-rounded-blur/` | Package staging tree |
| `*.pkg.tar.zst` | Final installable packages |

## Naming Conventions

### Files

- **Patches**: `snake_case.patch` — named after the feature (`rounded_corners_mask`, `liquid_glass_compositor`)
- **Scripts**: `kebab-case.sh` — action-oriented (`deploy-dhruva`, `apply-dhruva-fix`)
- **JS components**: `snake_case.js` in extension, `camelCase` for Dhruva-specific files
- **Planning docs**: `UPPER_CASE.md` for standard docs, phase directories use numbered kebab-case

### Code

- **C identifiers**: `shell_blur_effect_*` (GObject naming convention)
- **GLSL uniforms**: `u_corner_radius`, `u_size`, `u_refract_size` (prefixed)
- **JS classes**: `PascalCase` (`DhruvaBlur`, `DummyPipeline`, `BoxPointerBlur`)
- **JS methods**: `_snake_case` for private (`_blur_dock`, `_scan_for_docks`)
- **Actor names**: `PascalCase` strings (`'DhruvaContainer'`, `'DhruvaBackground'`)
- **Widget names**: `kebab-case` with `bms-` prefix (`'bms-dhruva-blur-wrapper'`, `'bms-dhruva-bg-group'`)

## File Dependencies

```
dhruva.js
  └── imports from blur-my-shell@aunetx:
        ├── conveniences/dummy_pipeline.js
        │     └── conveniences/effects_manager.js
        │           └── NativeDynamicGaussianBlurEffect (Mutter C)
        └── (injected via extension.js init()):
              ├── conveniences/connections.js
              ├── conveniences/settings.js
              └── conveniences/keys.js

PKGBUILD
  └── reads: patches/rounded_corners_mask.patch
  └── reads: patches/liquid_glass_compositor.patch (conditional)

install.sh
  └── invokes: PKGBUILD (via makepkg)

deploy-dhruva.sh / apply-dhruva-fix.sh
  └── reads: dhruva.js
  └── writes: ~/.local/share/.../components/dhruva.js
```
