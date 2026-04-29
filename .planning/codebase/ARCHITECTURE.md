# Architecture

## Overview
`blur-my-glass` is not a standalone application, but rather a set of source-level C patches applied to the GNOME Shell / Mutter compositor. It intercepts the `ShellBlurEffect` rendering pipeline to inject custom GLSL shaders.

## Patch Architecture
The project uses a stacked patch architecture:
1. **Base Patch (`rounded_corners_mask.patch`)**: Modifies `shell-blur-effect.c` to add a rounded corners mask using an SDF (Signed Distance Field). Adds the `corner-radius` property.
2. **Overlay Patch (`liquid_glass_compositor.patch`)**: Optionally applied on top of the base patch. Adds advanced refraction effects (zoom-lens warp, border highlights, gloss gradients) to achieve a "Liquid Glass" aesthetic. Adds the `refraction-strength` property.

## Rendering Pipeline Modifications
- **Masking:** Creates an additional `mask_fb` framebuffer and a `mask_pipeline` using `COGL_SNIPPET_HOOK_FRAGMENT`.
- **Refraction:** Replaces the texture lookup via `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP` with a custom `textureGrad` implementation that accounts for screen-space derivatives to prevent moiré artifacts during refraction warping.

## Build Flow
- `install.sh` acts as a frontend to `makepkg`.
- `PKGBUILD` clones upstream GNOME Shell, applies the patches in `prepare()`, and builds a replacement `gnome-shell` package.

*(Generated on 2026-04-29)*
