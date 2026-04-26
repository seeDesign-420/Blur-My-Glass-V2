# Architecture

> Mapped: 2026-04-26 (refreshed — reflects Phase 1+2 changes)

## Architectural Pattern

**Stacked Patch Distribution (Arch Linux PKGBUILD)**

blur-my-glass is a **source-level patch distribution** that produces a modified GNOME Shell system package. The core deliverable is two `.patch` files applied in a stacked architecture:

```
┌─────────────────────────────────────────────────────────┐
│                   blur-my-glass repo                    │
│                                                         │
│  ┌─────────────┐   ┌──────────────────────────────────┐ │
│  │  PKGBUILD   │──▷│  patches/ (stacked)              │ │
│  │  install.sh  │   │  ├─ rounded_corners_mask.patch   │ │
│  └──────┬──────┘   │  │    (base — always applied)     │ │
│         │          │  └─ liquid_glass_compositor.patch  │ │
│         │          │       (overlay — opt-in)           │ │
│         │          └──────────────────────────────────┘ │
│         ▼                                               │
│  ┌─────────────┐                                        │
│  │ makepkg      │ clones upstream → stacks patches      │
│  │ (Arch Linux) │ → meson build → pacman install        │
│  └──────┬──────┘                                        │
│         ▼                                               │
│  ┌──────────────────────────┐                           │
│  │ gnome-shell-rounded-blur │  provides: gnome-shell    │
│  │ (system package)         │  conflicts: gnome-shell   │
│  └──────────────────────────┘                           │
└─────────────────────────────────────────────────────────┘
```

## Stacked Patch Architecture

```
upstream gnome-shell 50.0
  └── rounded_corners_mask.patch  (base: AA mask, mask_fb, corner-radius)
        └── liquid_glass_compositor.patch  (overlay: refraction, specular, lighting)
```

- **Base patch** (`rounded_corners_mask.patch`, 313 lines): Always applied. Adds SDF rounded corners mask with anti-aliased edges (`smoothstep` + `fwidth`), the `mask_fb` FBO pipeline pass, and the `corner-radius` GObject property.
- **Overlay patch** (`liquid_glass_compositor.patch`, 253 lines): Optional. Applied on top of base. Adds refraction GLSL, specular border highlights, gradient lighting, and the `refraction-strength` GObject property.

## Rendering Pipeline (Patched)

### Base: Rounded Corners Mask
```
Paint request
    │
    ▼
┌──────────┐     ┌────────────┐     ┌──────────┐     ┌──────────┐
│ Actor FBO │──▷  │ Blur Node  │──▷  │Brightness│──▷  │ Mask FBO │──▷ Screen
│ (capture) │     │ (gaussian) │     │ FBO      │     │ (SDF AA) │
└──────────┘     └────────────┘     └──────────┘     └──────────┘
                                                          │
                                                    GLSL: SDF rounded
                                                    rect → smoothstep mask
```

### Overlay: Liquid Glass Compositor
```
Paint request
    │
    ▼
┌──────────┐     ┌────────────┐     ┌──────────────────┐     ┌──────────┐
│ Actor FBO │──▷  │ Blur Node  │──▷  │ Brightness FBO   │──▷  │ Mask FBO │──▷ Screen
│ (capture) │     │ (gaussian) │     │ + Refraction     │     │ (SDF AA) │
└──────────┘     └────────────┘     │ + Specular        │     └──────────┘
                                    │ + Border highlight│
                                    └──────────────────┘
                                          │
                                    GLSL snippets:
                                    ├─ TEXTURE_LOOKUP: box-lens refraction
                                    │   sin(pow(dist, 0.25)) UV warp
                                    └─ FRAGMENT: brightness + border + gradient
```

## Data Flow

### Build-Time Flow
1. User runs `./install.sh` (or `makepkg` directly)
2. `PKGBUILD` clones upstream GNOME Shell 50.0
3. `prepare()` always applies `rounded_corners_mask.patch`
4. If `BLUR_PATCH=liquid_glass_compositor`, also applies the overlay patch
5. `build()` compiles with `meson` + `ninja`
6. `package()` stages into `pkg/` and installs via `pacman`

### Runtime Flow
1. GNOME Shell starts with patched `ShellBlurEffect`
2. Extensions (e.g., blur-my-shell) create `ShellBlurEffect` instances
3. Extension sets GObject properties: `radius`, `brightness`, `corner-radius`, `refraction-strength`
4. On each paint cycle:
   - Capture actor/background to FBO
   - Apply gaussian blur (ClutterBlurNode)
   - Apply brightness + refraction GLSL (brightness pipeline)
   - Apply SDF rounded-rect mask (mask pipeline)
   - Composite to screen

## Abstraction Layers

| Layer | Responsibility | Files |
|-------|---------------|-------|
| **User interface** | `install.sh` — CLI installer | `install.sh` |
| **Package recipe** | `PKGBUILD` — build orchestration | `PKGBUILD` |
| **Patch payload** | The actual code changes | `patches/*.patch` |
| **Compositor (C)** | `ShellBlurEffect` — multi-pass FBO rendering | `shell-blur-effect.c`, `.h` |
| **Shader (GLSL)** | SDF mask, refraction, lighting | Inline strings in C source |
| **Extension API** | GObject properties exposed to GJS | Via GObject introspection |

## Entry Points

| Entry Point | Purpose |
|-------------|---------|
| `./install.sh` | Primary user entry — builds and installs the patched package |
| `PKGBUILD` | Direct `makepkg` entry for power users |
| `ShellBlurEffect` (runtime) | Created by GNOME Shell extensions at runtime |

## Key Design Decisions

1. **System package replacement** instead of extension-only approach — enables C-level compositor modifications that pure JS extensions cannot achieve
2. **Stacked patch architecture** — base (rounded corners) + optional overlay (liquid glass), eliminating code duplication and style drift
3. **SDF-based masking** — uses signed distance field math with `smoothstep(fwidth(dist))` for anti-aliased rounded corners
4. **Cogl snippet injection** — uses `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP` for refraction (pre-sampling UV warp) and `COGL_SNIPPET_HOOK_FRAGMENT` for post-sampling effects
5. **FBO chain** — adds a `mask_fb` pass after the existing `brightness_fb` pass, maintaining the existing paint node tree structure
