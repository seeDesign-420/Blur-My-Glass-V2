# Concerns

> Mapped: 2026-04-24

## Technical Debt

### 1. Liquid Glass Patch Style Reformatting
**Severity: Medium** | **Impact: Maintainability**

The `liquid_glass_compositor.patch` (1656 lines) reformats large portions of unchanged upstream code from GNOME's house style to K&R/clang-format style. This:
- Inflates the diff by ~3× compared to semantic changes alone (~400 new/changed LOC)
- Makes future rebasing onto new GNOME Shell versions significantly harder
- Creates merge conflicts on lines that have no functional change
- Makes code review difficult (noise obscures signal)

**Recommendation:** Regenerate the liquid glass patch with minimal formatting changes, matching the approach used in `rounded_corners_mask.patch` (322 lines, upstream style preserved).

### 2. Duplicated Patch Logic
**Severity: Low** | **Impact: Maintenance burden**

Both patches share the same SDF mask infrastructure (`mask_glsl`, `mask_fb`, `corner-radius` property), but are maintained as independent patch files with no shared base. Changes to the mask logic must be applied to both patches separately.

**Recommendation:** Consider a stacked patch approach: base patch (mask) + optional overlay (refraction/lighting).

### 3. Hardcoded GNOME Shell Version
**Severity: Medium** | **Impact: Version coupling**

`PKGBUILD` pins to `pkgver=50.0` and `mutter_api_version='18'`. Each GNOME major release requires:
- Updating `pkgver` and verifying the patch applies
- Testing against new Mutter API (e.g., paint node changes)
- Potentially rewriting patch hunks that touch modified upstream code

No automation exists to detect upstream changes that break patch applicability.

## Known Issues

### 1. Mask FBO Downscale Factor Inconsistency
**Severity: Low** | **Impact: Visual quality**

In the rounded corners patch, `update_mask_fbo()` receives and uses the `downscale_factor`, meaning the mask texture is downscaled along with the blur texture. In the liquid glass patch, `update_mask_fbo()` is called with hardcoded `1.0`:
```c
// liquid glass patch
updated = update_actor_fbo(self, width, height, downscale_factor) &&
          update_brightness_fbo(self, width, height, downscale_factor) &&
          update_mask_fbo(self, width, height, 1.0);  // Always full-res
```
This means the mask always runs at full resolution in liquid glass mode — potentially intentional for quality but undocumented.

### 2. SDF Distance Function Variant
**Severity: Info** | **Impact: Visual correctness**

The rounded corners patch uses `step(dist, 0.0)` for a hard mask edge, while the liquid glass patch uses `smoothstep(aa, -aa, dist)` with `fwidth()` for anti-aliased edges. The correct SDF box distance includes `min(max(q.x, q.y), 0.0)` for the interior term — present in liquid glass but missing from rounded corners.

Rounded corners SDF:
```glsl
float dist = length(max(q, vec2(0.0))) - u_corner_radius;  // Missing interior term
float m = step(dist, 0.0);  // Hard edge
```

Liquid glass SDF:
```glsl
float dist = min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - u_corner_radius;  // Correct
float m = smoothstep(aa, -aa, dist);  // Anti-aliased
```

## Security Considerations

### 1. Supply Chain
- Upstream source is fetched from `gitlab.gnome.org` over HTTPS — integrity verified by `b2sums` in PKGBUILD
- Subprojects are pinned to specific commits — good
- No third-party dependencies beyond GNOME ecosystem

### 2. Shader Input Validation
- All uniform values go through GObject property setters with range validation
- `corner_radius`: clamped to `MAX(0.f, value)`
- `refraction_strength`: clamped to `CLAMP(value, 0.f, 2.f)`
- No user-supplied shader code — all GLSL is compile-time static strings

### 3. Privilege Level
- The patched binary runs as the user's GNOME Shell session (not root)
- `install.sh` uses `sudo` only for `pacman -S` (makedepends installation)
- Build runs entirely as unprivileged user via `makepkg`

## Performance Concerns

### 1. Additional FBO Pass
Both patches add a `mask_fb` framebuffer pass to the render pipeline. This means:
- One additional texture allocation per blur effect instance
- One additional full-screen draw call per paint cycle
- For N blur effects active simultaneously, that's N additional texture binds + draws

**Measured impact:** Minimal on modern GPUs (Intel, AMD, NVIDIA discrete) — the mask shader is trivially simple. Could be measurable on integrated graphics with many simultaneous blur regions.

### 2. Liquid Glass Refraction
The refraction shader runs at the `TEXTURE_LOOKUP` hook, meaning it executes **per-texel** during the brightness pass. The `sin(pow(dist, 0.25) * π/2)` warp involves:
- `pow()` with fractional exponent (expensive)
- `sin()` trigonometric function
- SDF evaluation with per-corner radius support

This is within acceptable bounds for modern desktop GPUs but could impact frame times on low-power hardware.

## Fragile Areas

### 1. Cogl Snippet Hook Points
The refraction shader hooks into `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP` — an internal Cogl API that modifies UV coordinates before texture sampling. This is a fragile integration point:
- Hook semantics could change between Mutter versions
- The `cogl_tex_coord` variable used in the pre-hook is an implementation detail
- No upstream stability guarantee for snippet hook behavior

### 2. Paint Node Tree Structure
The patch inserts the mask node as a parent of the brightness node in the paint tree. This depends on the specific structure of `create_blur_nodes()` which is internal to `ShellBlurEffect`. Any upstream refactoring of the paint node tree will break both patches.

### 3. Single File, Single Function Patches
Both patches modify a single source file (`shell-blur-effect.c`). This is both a strength (minimal surface area) and a weakness (any upstream change to this file may conflict). The file is ~950 lines upstream and grows to ~1100 lines with the liquid glass patch.
