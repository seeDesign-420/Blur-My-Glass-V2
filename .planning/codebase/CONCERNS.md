# Concerns — blur-my-glass

> Last mapped: 2026-04-29

## Critical Concerns

### C1: Upstream Version Lock

**Risk: HIGH** | **Impact: Build breakage on GNOME update**

Patches are hardcoded to GNOME Shell 50.0 (`pkgver=50.0`). When GNOME releases 50.1+ or 51.x:
- Patches will likely fail to apply (changed context lines)
- The entire PKGBUILD and both patches need manual rebasing
- Users get a broken build until patches are updated

**Affected files:** `PKGBUILD`, `patches/rounded_corners_mask.patch`, `patches/liquid_glass_compositor.patch`

**Mitigation:** The patched code in `shell-blur-effect.c` is relatively stable upstream — major refactors are rare. But point releases can shift line numbers enough to break patch context.

---

### C2: System Package Replacement

**Risk: HIGH** | **Impact: Broken desktop session**

The package `provides=('gnome-shell')` and `conflicts=('gnome-shell')`. A broken build or shader bug can render the user's entire desktop session unusable (black screen, crash loop).

**Affected files:** `PKGBUILD` (lines 131-132)

**Mitigation:** Recovery path is `sudo pacman -S gnome-shell` from a TTY. Users should be comfortable with command-line package management.

---

### C3: Stale `.patch.tmp` File

**Risk: LOW** | **Impact: Confusion**

`patches/liquid_glass_compositor.patch.tmp` is an obsolete WIP copy of the overlay patch with slightly different diff headers (uses `orig` suffixed filenames). It's tracked in git but appears to be a development leftover.

**Affected files:** `patches/liquid_glass_compositor.patch.tmp`

**Action:** Delete and add to `.gitignore`, or rename if it serves a purpose.

---

## Technical Debt

### D1: No Build CI

There is no continuous integration. Build breakage is only discovered when a developer runs `makepkg` locally. Given the upstream version lock (C1), any GNOME Shell update could silently break the build.

**Recommendation:** Add a GitHub Actions workflow using an Arch Linux Docker container that runs `makepkg` on push and on a schedule.

---

### D2: Hardcoded GNOME Shell Version

The version `50.0` appears in multiple places:
- `PKGBUILD` line 12: `pkgver=50.0`
- `README.md` line 21: "Requires... GNOME 50"
- `install.sh` line 82: "GNOME Shell version: 50.0"
- `PKGBUILD` line 87: git tag reference

Updating to a new GNOME Shell version requires touching at least 4 files. This should be consolidated (e.g., a single version variable sourced by all scripts).

---

### D3: `meson.build` `tests=false`

Tests are explicitly disabled (`-D tests=false` in `PKGBUILD` line 117). While this speeds up the build, it means upstream GNOME Shell's own test suite is never run against the patched code. If a patch accidentally breaks an upstream invariant, it won't be caught.

---

## Shader Concerns

### S1: GLSL Shared Globals Pattern

The liquid glass overlay uses a non-standard pattern of GLSL "shared globals" between shader stages:

```c
// Declared in texture-lookup snippet (runs first)
"float r_transition = 0.0;  \n"
"float r_border = 0.0;      \n"
"float r_gradient = 0.0;    \n"

// Read in fragment snippet (runs second)
"cogl_color_out.rgb += vec3(r_border * r_transition * 0.15);  \n"
```

This works because Cogl assembles both snippets into a single GLSL program. But it's fragile — if Cogl's snippet assembly order changes in a future Mutter version, these globals would be undefined.

**Affected files:** `patches/liquid_glass_compositor.patch` (refraction declarations + brightness fragment)

---

### S2: Refraction Uniforms on Wrong Pipeline

The refraction uniforms (`refraction_strength`, `u_refract_size`, `u_refract_radius`) are set on `brightness_fb.pipeline` but the mask uniforms are set on `mask_fb.pipeline`. The `update_mask_uniforms()` function handles both sets of uniforms — setting brightness pipeline uniforms from a function named for the mask pipeline.

This is correct behavior (refraction is a texture-lookup on the brightness pipeline's sampler), but the naming is misleading and could cause bugs during future refactoring.

**Affected files:** `patches/liquid_glass_compositor.patch` (lines 135-151)

---

### S3: No Graceful Fallback for Missing Properties

If blur-my-shell or another extension tries to set `refraction-strength` on a build without the liquid glass overlay, it will get a GObject warning at runtime (property doesn't exist). There's no mechanism to detect which patch variant is installed.

**Recommendation:** Consider a `has-refraction` boolean property in the base patch that returns `FALSE`, overridden to `TRUE` by the overlay.

---

## Performance Concerns

### P1: Additional FBO Render Pass

The base patch adds one extra full-resolution FBO pass (`mask_fb`) to every blur effect render cycle. For a typical desktop with 2-3 blur panels, this means 2-3 extra off-screen render targets per frame.

The GPU cost is low (single texture sample + SDF math per fragment), but the memory cost of the additional FBO textures at display resolution is non-trivial on memory-constrained GPUs.

---

### P2: No Downscale Optimization for Mask Pass

The blur pass uses `downscale_factor` to render at reduced resolution. The mask pass receives the same `downscale_factor` in `update_mask_fbo()`, so it matches the blur resolution — but the SDF mask would look identical at any resolution. The mask pass could potentially run at a fixed small size and be upscaled.

---

## Security Concerns

None identified. The project is a local build system with no network calls, no user data handling, and no privilege escalation beyond what `makepkg` / `pacman` already require.

---

## Fragile Areas

| Area | Why It's Fragile |
|------|-----------------|
| Patch context lines | Any upstream change to `shell-blur-effect.c` breaks patch application |
| GLSL shared globals (`r_*`) | Depends on Cogl snippet assembly order being stable across Mutter versions |
| `FramebufferData` struct layout | Adding `mask_fb` assumes the struct has no alignment or ordering constraints |
| `N_PROPS` enum | Adding properties shifts the enum; overlay depends on base patch's enum value |
| `create_brightness_pipeline()` static | Overlay modifies a `static` pipeline factory — if upstream adds similar modifications, merge conflicts are guaranteed |
