# Architecture

*Mapped: 2026-05-03*

## System Overview

blur-my-glass is a **two-layer** project:

1. **C-level compositor patches** — modify Mutter's `ShellBlurEffect` to add GPU-rendered rounded corners and refraction
2. **JS-level extension component** — integrates the patched blur into third-party GNOME Shell extensions (Dhruva dock)

```
┌─────────────────────────────────────────────────────┐
│                   GNOME Shell 50.0                   │
│  ┌───────────────────────────────────────────────┐  │
│  │          ShellBlurEffect (C / Cogl)           │  │
│  │  ┌─────────────┐  ┌──────────────────────┐   │  │
│  │  │ mask_fb      │  │ brightness_fb         │   │  │
│  │  │ (SDF mask)   │  │ (refraction + light)  │   │  │
│  │  └─────────────┘  └──────────────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
│                         ▲                            │
│                         │ GObject property:           │
│                         │ corner-radius, refraction   │
│  ┌───────────────────────────────────────────────┐  │
│  │        blur-my-shell Extension (GJS)          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ dhruva   │ │boxpointer│ │ panel, dash  │  │  │
│  │  │  .js     │ │  .js     │ │ overview,etc │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  │       │                                       │  │
│  │  DummyPipeline → EffectsManager               │  │
│  │       │                                       │  │
│  │  NativeDynamicBlurEffect (ShellBlurEffect)    │  │
│  └───────────────────────────────────────────────┘  │
│                         ▲                            │
│                         │ Runtime discovery           │
│  ┌───────────────────────────────────────────────┐  │
│  │           Dhruva Dock Extension               │  │
│  │   DhruvaContainer → DhruvaBackground          │  │
│  │                   → Dhruva (icons)             │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Architectural Patterns

### 1. Stacked Patch Architecture

Patches are applied in layers during `PKGBUILD prepare()`:

```
Layer 0: Upstream GNOME Shell 50.0 (unmodified)
  │
  ├── Layer 1: rounded_corners_mask.patch (ALWAYS applied)
  │     - Adds mask_fb FBO + SDF mask GLSL
  │     - Adds corner-radius GObject property
  │     - 314 lines
  │
  └── Layer 2: liquid_glass_compositor.patch (OPTIONAL overlay)
        - Adds refraction GLSL via COGL_SNIPPET_HOOK_TEXTURE_LOOKUP
        - Adds border highlight + vertical gradient gloss
        - Adds refraction-strength GObject property
        - 250 lines — applies on top of Layer 1
```

### 2. Component-Based Extension Architecture

`dhruva.js` follows the blur-my-shell component pattern:

```javascript
class DhruvaBlur {
    constructor(connections, settings, effects_manager) // Standard 3-arg init
    enable()   // Register signals, scan for actors, inject blur
    disable()  // Disconnect signals, destroy blur widgets, cleanup timers
}
```

All components share:
- `Connections` instance for signal lifecycle
- `Settings` instance for GSettings access
- `EffectsManager` for GPU effect pooling

### 3. Sibling Blur Injection Pattern

Both `BoxPointerBlur` and `DhruvaBlur` use the same spatial strategy:

```
parent (uiGroup / stage)
  ├── blur-wrapper (St.Widget, reactive:false)
  │     └── Meta.BackgroundGroup
  │           └── blurWidget (St.Widget + NativeDynamicBlurEffect)
  └── target actor (DhruvaContainer / BoxPointer)
```

Key properties:
- `parent.insert_child_below(wrapper, target)` — below in paint order
- `wrapper.reactive = false` — non-interactive, click-through
- Geometry synced via `get_transformed_position()` / `transform_stage_point()`

### 4. Runtime Actor Discovery

Dhruva dock actors are discovered at runtime (no import dependency):

1. **Signal-based**: `Main.uiGroup` / `global.stage` `child-added` events
2. **Timer-based**: 4 delayed scans at 500ms, 2s, 5s, 10s to handle load-order races
3. **Name-based**: `actor.get_name() === 'DhruvaContainer'`

## Data Flow

### Blur Effect Pipeline (per frame)

```
1. Actor geometry changes (position, scale, translation)
   │
2. notify::* signal fires on DhruvaBackground or DhruvaContainer
   │
3. sync_geometry() callback:
   a. get_transformed_position() → absolute stage coords
   b. transform_stage_point() → parent-local coords
   c. get_transformed_size() → post-scale dimensions
   d. wrapper.set_position() + set_size()
   e. blurWidget.set_position() + set_size()
   │
4. pipeline.effect.queue_repaint()
   │
5. ShellBlurEffect vfunc_paint_node():
   a. Capture background FBO
   b. Apply Gaussian blur (ClutterBlurNode)
   c. Apply brightness (brightness_fb)
   d. Apply refraction warp (liquid glass only, brightness_fb texture lookup)
   e. Apply SDF mask (mask_fb)
   f. Composite to screen
```

### Settings Change Flow

```
GSettings changed signal
  → extension.js _connect_to_settings() callback
    → dhruva_blur.disable()
    → dhruva_blur.enable()
      → Destroys all blur widgets
      → Re-scans for docks
      → Re-creates blur with new settings
```

## Entry Points

| Entry Point | File | Trigger |
|-------------|------|---------|
| Build | `PKGBUILD` | `makepkg -si` |
| Install | `install.sh` | User runs `./install.sh [--liquid-glass]` |
| Deploy Dhruva | `deploy-dhruva.sh` | Copies `dhruva.js` to extension dir |
| Apply fix | `apply-dhruva-fix.sh` | Copies `dhruva.js` + compiles schemas |
| Extension load | `extension.js` | GNOME Shell `enable()` |
| Component init | `dhruva.js` | `new DhruvaBlur(connections, settings, effects_manager)` |

## Key Abstractions

| Abstraction | Source | Purpose |
|-------------|--------|---------|
| `DummyPipeline` | `conveniences/dummy_pipeline.js` | Wraps effect creation + settings binding for dynamic blur |
| `EffectsManager` | `conveniences/effects_manager.js` | GPU effect pool — prevents RAM bleeding from repeated effect creation |
| `Connections` | `conveniences/connections.js` | Signal lifecycle management — bulk disconnect on disable |
| `Settings` | `conveniences/settings.js` | Type-safe GSettings accessor with `_changed()` callback registration |
| `ShellBlurEffect` | `shell-blur-effect.c` (patched) | Mutter's blur effect with added mask FBO + refraction |
