# Architecture — blur-my-glass

> Last mapped: 2026-04-29

## Architectural Pattern

**Source-level compositor patching** — This project modifies GNOME Shell's C source code at build time via `patch(1)`, then rebuilds the entire GNOME Shell package. It is not a plugin or extension — it changes the compositor binary itself.

### Why Not a Pure Extension?

GNOME Shell's `ShellBlurEffect` (a `ClutterEffect` subclass) is implemented in C and compiled into the shell binary. Its GLSL shaders and FBO pipeline are not extensible from JavaScript. Adding a `corner-radius` property requires:

1. New GLSL uniform declarations
2. New Cogl pipeline snippets
3. A new FBO render pass (`mask_fb`)
4. GObject property registration for JS accessibility

None of these are achievable from a GJS extension — hence source patching.

## Stacked Patch Architecture

The project uses a two-layer patch system where patches stack sequentially:

```
┌─────────────────────────────────────────────────────┐
│             Upstream GNOME Shell 50.0                │
│          src/shell-blur-effect.{c,h}                │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼ always applied
┌─────────────────────────────────────────────────────┐
│       Base Patch: rounded_corners_mask.patch         │
│  (314 lines)                                        │
│                                                     │
│  + SDF mask GLSL (box distance + smoothstep AA)     │
│  + mask_fb FBO pipeline and render pass             │
│  + corner-radius GObject property                   │
│  + Mask pipeline factory (create_mask_pipeline)     │
│  + update_mask_uniforms() function                  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼ conditionally applied (--liquid-glass)
┌─────────────────────────────────────────────────────┐
│    Overlay Patch: liquid_glass_compositor.patch      │
│  (250 lines)                                        │
│                                                     │
│  + Refraction GLSL (zoom-lens sin() warp)           │
│  + textureGrad with Jacobian derivatives            │
│  + SDF border highlight + top-light gloss           │
│  + refraction-strength GObject property             │
│  + Refraction uniforms on brightness_fb pipeline    │
└─────────────────────────────────────────────────────┘
```

### Patch Stacking Mechanism

In `PKGBUILD` `prepare()`:
1. **Always:** `patch -p1 -i patches/rounded_corners_mask.patch`
2. **If `BLUR_PATCH=liquid_glass_compositor`:** `patch -p1 -i patches/liquid_glass_compositor.patch`

The overlay patch's context lines reference code introduced by the base patch — they cannot be applied independently.

## Rendering Pipeline (Post-Patch)

### FBO Chain — Actor Blur Mode

```
actor_fb (capture actor)
  → blur_node (Clutter gaussian blur)
    → brightness_fb (brightness + refraction* + gloss*)
      → mask_fb (SDF rounded corner clip)
        → final composite
```

*Items marked with `*` are only present with the liquid glass overlay.

### FBO Chain — Background Blur Mode

```
background_fb (capture behind actor)
  → blur_node (Clutter gaussian blur)
    → brightness_fb (brightness + refraction* + gloss*)
      → mask_fb (SDF rounded corner clip)
        → final composite
```

### Shader Stages

| Stage | Hook | Pipeline | Purpose |
|-------|------|----------|---------|
| 1. Texture lookup | `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP` | `brightness_fb` | UV refraction warp (liquid glass only) |
| 2. Fragment | `COGL_SNIPPET_HOOK_FRAGMENT` | `brightness_fb` | Brightness multiply + border/gloss (liquid glass extends this) |
| 3. Fragment | `COGL_SNIPPET_HOOK_FRAGMENT` | `mask_fb` | SDF rounded rectangle alpha clip |

### Key Data Structures

```c
struct _ShellBlurEffect {
    // Existing upstream fields
    FramebufferData actor_fb;
    FramebufferData background_fb;
    FramebufferData brightness_fb;
    int brightness_uniform;

    // Added by base patch
    FramebufferData mask_fb;
    int corner_radius_uniform;    // u_corner_radius
    int mask_size_uniform;        // u_size
    float corner_radius;

    // Added by liquid glass overlay
    int refract_size_uniform;     // u_refract_size
    int refract_radius_uniform;   // u_refract_radius
    int refraction_strength_uniform; // refraction_strength
    float refraction_strength;

    // Existing
    ShellBlurMode mode;
    float downscale_factor;
    float brightness;
    int radius;
};
```

## Entry Points

| Entry Point | Type | Description |
|------------|------|-------------|
| `install.sh` | User-facing CLI | Orchestrates `makepkg` with patch selection |
| `PKGBUILD` `prepare()` | Build system | Applies patches to cloned source |
| `PKGBUILD` `build()` | Build system | Runs `meson compile` |
| `shell_blur_effect_init()` | C runtime | Initializes pipelines, creates FBOs, resolves uniforms |
| `shell_blur_effect_paint_node()` | C runtime | Executes the full FBO rendering chain each frame |

## Abstraction Layers

```
┌─────────────────────────────────────────┐
│  User Interface: install.sh (Bash)      │  ← User runs this
├─────────────────────────────────────────┤
│  Build System: PKGBUILD (makepkg)       │  ← Drives patch + compile
├─────────────────────────────────────────┤
│  Patch Layer: patches/*.patch (diff)    │  ← The actual IP
├─────────────────────────────────────────┤
│  C Source: shell-blur-effect.{c,h}      │  ← Modified compositor code
├─────────────────────────────────────────┤
│  GPU: GLSL shaders (inline strings)     │  ← SDF mask, refraction
├─────────────────────────────────────────┤
│  Framework: Cogl/Clutter/Mutter         │  ← Upstream rendering stack
└─────────────────────────────────────────┘
```
