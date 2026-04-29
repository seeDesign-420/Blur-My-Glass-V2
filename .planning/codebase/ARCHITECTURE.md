# Architecture

*Last mapped: 2026-04-29*

## System Overview

blur-my-glass is a **two-layer system**: a C-level compositor patch and a JavaScript extension layer. The C patch adds GPU shader capabilities to GNOME Shell's blur effect; the JS extension layer orchestrates where and how those capabilities are applied.

```
┌─────────────────────────────────────────────────────────────────┐
│  blur-my-shell Extension (JS / GJS)                             │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌────────┐           │
│  │  Panel    │ │ Overview │ │ BoxPointer │ │ Dhruva │  ...      │
│  │  Blur     │ │ Blur     │ │ Blur       │ │ Blur   │           │
│  └────┬─────┘ └────┬─────┘ └─────┬──────┘ └───┬────┘           │
│       └──────────┬──┘             │             │               │
│            ┌─────▼──────┐  ┌─────▼──────┐      │               │
│            │  Pipeline  │  │ DummyPipe  │◄─────┘               │
│            │  (static)  │  │ (dynamic)  │                       │
│            └─────┬──────┘  └─────┬──────┘                       │
│                  └──────┬────────┘                               │
│              ┌──────────▼──────────┐                             │
│              │ NativeDynamic       │                             │
│              │ GaussianBlurEffect  │                             │
│              │ (GObject subclass   │                             │
│              │  of Shell.BlurEffect│                             │
│              └──────────┬──────────┘                             │
└─────────────────────────┼───────────────────────────────────────┘
                          │ GObject property access
┌─────────────────────────▼───────────────────────────────────────┐
│  Patched GNOME Shell (C / Cogl / GLSL)                          │
│  ┌──────────────────────────────────────────┐                   │
│  │  ShellBlurEffect (shell-blur-effect.c)   │                   │
│  │  ├── actor_fb      (scene capture)       │                   │
│  │  ├── background_fb (screen capture)      │                   │
│  │  ├── brightness_fb (brightness + refract)│                   │
│  │  └── mask_fb       (SDF rounded mask)    │                   │
│  └──────────────────────────────────────────┘                   │
│  Properties: radius, brightness, corner-radius,                 │
│              refraction-strength, mode                           │
└─────────────────────────────────────────────────────────────────┘
```

## Architectural Pattern

**Patch-and-extend pattern:** The core capability (rounded blur, refraction) is implemented as C patches to the system compositor. An unrelated JS extension layer consumes those capabilities via GObject properties. The two layers are **loosely coupled** — the extension gracefully degrades if the patch isn't installed.

## Data Flow

### Build-Time Flow
```
PKGBUILD.prepare()
  → git clone gnome-shell 50.0
  → patch -p1 rounded_corners_mask.patch     (always)
  → patch -p1 liquid_glass_compositor.patch   (if BLUR_PATCH=liquid_glass_compositor)
  → meson compile → meson install
  → pacman replaces system gnome-shell
```

### Runtime Flow (blur application)
```
1. User logs in → GNOME Shell loads blur-my-shell extension
2. extension.js → enable() creates component instances (PanelBlur, BoxPointerBlur, DhruvaBlur, ...)
3. Component detects target actor (e.g., DhruvaContainer via child-added signal)
4. Component creates DummyPipeline → NativeDynamicBlurEffect → Shell.BlurEffect
5. Shell.BlurEffect.paint():
   a. Capture actor content into actor_fb
   b. Capture background into background_fb
   c. Apply brightness (+ refraction if overlay patch) → brightness_fb
   d. Apply SDF mask → mask_fb
   e. Composite to screen
6. On geometry change → component updates blur widget position/size
7. On settings change → GSettings signal → DummyPipeline updates effect properties
```

### Extension Lifecycle
```
enable()
  ├── Settings, Connections, EffectsManager, PipelinesManager
  ├── Create 11 component instances (Panel, Overview, Dash, Lockscreen,
  │   AppFolders, WindowList, CoverflowAltTab, Applications, Screenshot,
  │   BoxPointer, Dhruva)
  ├── Connect settings change handlers
  ├── Enable lockscreen blur (works in unlock-dialog mode)
  └── On session-mode 'user' → _enable_components()

disable()
  ├── _disable_user_session() → each component.disable()
  ├── Lockscreen.disable()
  ├── Disconnect all signals
  ├── Null all component references
  └── Remove clipped redraws flag
```

## Key Abstractions

### Pipeline vs DummyPipeline
- **Pipeline** — Full pipeline with pipelines manager integration, static blur support, monitor-aware background
- **DummyPipeline** — Lightweight wrapper for dynamic blur. Creates `St.Widget` + `NativeDynamicBlurEffect`. Used by BoxPointer and Dhruva components.

### Connections
Signal management utility. Each component gets its own `Connections` instance. All disconnected on `disable()`.

### EffectsManager
Object pool for blur effects. Prevents "RAM bleeding" from repeated effect creation/destruction.

## Entry Points

| Entry Point | Purpose |
|-------------|---------|
| `PKGBUILD` | Build entry — `prepare()`, `build()`, `package_*()` |
| `install.sh` | User-facing build + install orchestrator |
| `extension.js` | GNOME Shell extension entry — `enable()`, `disable()` |
| `patches/*.patch` | Source-level modifications to `shell-blur-effect.c/.h` |
