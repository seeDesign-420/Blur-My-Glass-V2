# Architecture

> Mapped: 2026-04-24

## Architectural Pattern

**Patch-and-Replace System Package**

blur-my-glass is not a library or application — it's a **source-level patch distribution** that produces a modified system package. The architecture is:

```
┌─────────────────────────────────────────────────────────┐
│                   blur-my-glass repo                    │
│                                                         │
│  ┌─────────────┐   ┌──────────────────────────────────┐ │
│  │  PKGBUILD   │──▷│  patches/                        │ │
│  │  install.sh  │   │  ├─ rounded_corners_mask.patch   │ │
│  └──────┬──────┘   │  └─ liquid_glass_compositor.patch │ │
│         │          └──────────────────────────────────┘ │
│         ▼                                               │
│  ┌─────────────┐                                        │
│  │ makepkg      │ clones upstream → applies patch       │
│  │ (Arch Linux) │ → meson build → pacman install        │
│  └──────┬──────┘                                        │
│         ▼                                               │
│  ┌──────────────────────────┐                           │
│  │ gnome-shell-rounded-blur │  provides: gnome-shell    │
│  │ (system package)         │  conflicts: gnome-shell   │
│  └──────────────────────────┘                           │
└─────────────────────────────────────────────────────────┘
```

## Rendering Pipeline (Patched)

The patches modify `ShellBlurEffect` in GNOME Shell's C layer. The rendering pipeline is a multi-pass FBO chain:

### Rounded Corners Mask Patch
```
Paint request
    │
    ▼
┌──────────┐     ┌────────────┐     ┌──────────┐     ┌──────────┐
│ Actor FBO │──▷  │ Blur Node  │──▷  │Brightness│──▷  │ Mask FBO │──▷ Screen
│ (capture) │     │ (gaussian) │     │ FBO      │     │ (SDF)    │
└──────────┘     └────────────┘     └──────────┘     └──────────┘
                                                          │
                                                    GLSL: SDF rounded
                                                    rect → alpha mask
```

### Liquid Glass Compositor Patch
```
Paint request
    │
    ▼
┌──────────┐     ┌────────────┐     ┌──────────────────┐     ┌──────────┐
│ Actor FBO │──▷  │ Blur Node  │──▷  │ Brightness FBO   │──▷  │ Mask FBO │──▷ Screen
│ (capture) │     │ (gaussian) │     │ + Refraction     │     │ (SDF)    │
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
3. `prepare()` applies selected patch to `src/shell-blur-effect.c` and `.h`
4. `build()` compiles with `meson` + `ninja`
5. `package()` stages into `pkg/` and installs via `pacman`

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
2. **Two-variant patch system** — stable minimal patch (rounded corners) vs. experimental full pipeline (liquid glass), selectable at build time
3. **SDF-based masking** — uses signed distance field math for anti-aliased rounded corners rather than texture-based masks
4. **Cogl snippet injection** — uses `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP` for refraction (pre-sampling UV warp) and `COGL_SNIPPET_HOOK_FRAGMENT` for post-sampling effects
5. **FBO chain** — adds a `mask_fb` pass after the existing `brightness_fb` pass, maintaining the existing paint node tree structure
