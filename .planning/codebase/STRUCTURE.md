# Directory Structure

*Last mapped: 2026-04-29*

## Project Root (`blur-my-glass-live/`)

```
blur-my-glass-live/
├── PKGBUILD                          # Arch Linux package build script (167 lines)
├── install.sh                        # User-facing installer (123 lines)
├── README.md                         # Project documentation
├── .gitignore                        # Excludes build artifacts, source checkouts
│
├── patches/                          # C source patches
│   ├── rounded_corners_mask.patch    # Base: SDF mask + corner-radius (314 lines)
│   ├── liquid_glass_compositor.patch # Overlay: refraction + specular (250 lines)
│   └── liquid_glass_compositor.patch.tmp  # WIP overlay variant
│
├── .planning/                        # GSD project management
│   ├── PROJECT.md                    # Project definition and scope
│   ├── REQUIREMENTS.md               # Requirements with traceability
│   ├── ROADMAP.md                    # Phase-based roadmap (6 phases)
│   ├── STATE.md                      # Current position tracker
│   ├── codebase/                     # These documents (codebase mapping)
│   ├── debug/                        # Debug session state files
│   └── phases/                       # Per-phase artifacts
│       └── 06-dhruva-dock-integration/
│           └── RESEARCH.md
│
├── gnome-shell/                      # [.gitignore] Bare git clone of upstream (pulled by makepkg)
├── src/                              # [.gitignore] makepkg source directory
│   └── gnome-shell/                  # Patched GNOME Shell source tree
│       ├── src/                      # C source (shell-blur-effect.c/.h are patched here)
│       ├── js/                       # Upstream GNOME Shell JavaScript
│       ├── tests/                    # Upstream unit tests (jasmine-gjs)
│       ├── data/                     # GSettings schemas, CSS, desktop files
│       └── meson.build               # Build configuration
├── pkg/                              # [.gitignore] makepkg package staging
├── libgnome-volume-control/          # [.gitignore] GVC subproject
├── jasmine-gjs/                      # [.gitignore] Test framework subproject
├── libshew/                          # [.gitignore] Shell extensions helper subproject
└── .scratch/                         # Temporary working files
```

## Extension Files (installed at runtime)

Located at `~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/`:

```
blur-my-shell@aunetx/
├── extension.js                      # Entry point: enable/disable, component wiring (713 lines)
├── components/
│   ├── boxpointer.js                 # BoxPointer/popup menu blur (491 lines)
│   ├── dhruva.js                     # Dhruva dock blur (427 lines)
│   ├── appfolders.js                 # App folders blur
│   ├── panel.js                      # Top panel blur
│   ├── overview.js                   # Activities overview blur
│   ├── dash_to_dock.js               # Dash to Dock blur
│   ├── lockscreen.js                 # Lock screen blur
│   ├── window_list.js                # Window list blur
│   ├── coverflow_alt_tab.js          # Coverflow Alt-Tab blur
│   ├── applications.js               # Application window blur
│   └── screenshot.js                 # Screenshot blur
├── conveniences/
│   ├── dummy_pipeline.js             # Lightweight dynamic blur pipeline (147 lines)
│   ├── pipeline.js                   # Full static blur pipeline
│   ├── pipelines_manager.js          # Pipeline registry and management
│   ├── effects_manager.js            # Effect object pool
│   ├── connections.js                # Signal connection management
│   ├── settings.js                   # GSettings wrapper
│   ├── keys.js                       # Settings key definitions
│   ├── settings_updater.js           # Old settings migration
│   ├── paint_signals.js              # Repaint signal coordination
│   └── utils.js                      # Shell/preferences detection utilities
└── effects/
    └── native_dynamic_gaussian_blur.js  # GObject subclass of Shell.BlurEffect (105 lines)
```

## Key Locations

| What | Where |
|------|-------|
| Patches (project source of truth) | `patches/*.patch` |
| Build script | `PKGBUILD` |
| User installer | `install.sh` |
| Patched C file (after build) | `src/gnome-shell/src/shell-blur-effect.c` |
| Extension entry point | `~/.local/.../blur-my-shell@aunetx/extension.js` |
| Custom components (our additions) | `components/boxpointer.js`, `components/dhruva.js` |
| Blur effect wrapper | `effects/native_dynamic_gaussian_blur.js` |
| Dynamic blur helper | `conveniences/dummy_pipeline.js` |
| Project planning | `.planning/` |

## Naming Conventions

- **Patch files:** `snake_case.patch` — descriptive of what the patch does
- **JS components:** `snake_case.js` — matches blur-my-shell upstream convention
- **JS classes:** `PascalCase` — e.g., `BoxPointerBlur`, `DhruvaBlur`, `DummyPipeline`
- **C identifiers:** `snake_case` — follows GObject/GNOME C conventions
- **GObject properties:** `kebab-case` — e.g., `corner-radius`, `refraction-strength`
- **GSettings keys:** `kebab-case` — e.g., `changed::corner-radius`
- **Actor names:** `PascalCase` — e.g., `DhruvaContainer`, `DhruvaBackground`
- **BMS widget names:** `bms-*` prefix — e.g., `bms-dhruva-blurred-widget`, `bms-boxpointer-blurred-widget`
