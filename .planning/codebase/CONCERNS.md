# Concerns

> Mapped: 2026-04-26 (refreshed — reflects Phase 1+2 changes)

## Resolved Technical Debt

### ✅ SDF Anti-Aliasing (Phase 1)
Previously the base patch used `step(dist, 0.0)` for a hard mask edge and was missing the interior SDF term. **Fixed:** both patches now use the correct `min(max(q.x, q.y), 0.0)` interior term with `smoothstep(fwidth(dist))` for anti-aliased edges.

### ✅ Duplicated Patch Logic (Phase 2)
Previously the liquid glass patch (1656 lines) was a standalone diff that duplicated all mask infrastructure and reformatted ~60% of unchanged upstream code. **Fixed:** now uses a stacked architecture — base (313 lines) + overlay (253 lines, 86% smaller). Zero duplicated mask code.

## Remaining Technical Debt

### 1. Hardcoded GNOME Shell Version
**Severity: Medium** | **Impact: Version coupling**

`PKGBUILD` pins to `pkgver=50.0` and `mutter_api_version='18'`. Each GNOME major release requires:
- Updating `pkgver` and verifying the patch applies
- Testing against new Mutter API (e.g., paint node changes)
- Potentially rewriting patch hunks that touch modified upstream code

No automation exists to detect upstream changes that break patch applicability.

### 2. Overlay Patch Context Lines
**Severity: Low** | **Impact: Fragility**

The overlay patch uses context lines from the base-patched file to locate insertion points. If the base patch is modified (e.g., SDF formula change), the overlay may fail to apply due to context mismatch. This is inherent to stacked patching but could be mitigated with a `git format-patch` workflow.

## Known Issues

### 1. Mask FBO Downscale Factor
**Severity: Info** | **Impact: Visual quality / performance**

In the base patch, `update_mask_fbo()` receives the `downscale_factor`. In a liquid glass build the mask should ideally run at full resolution for quality. This is an open design question for future optimization.

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
Both build variants add a `mask_fb` framebuffer pass to the render pipeline. This means:
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
Both patches modify a single source file (`shell-blur-effect.c`). This is both a strength (minimal surface area) and a weakness (any upstream change to this file may conflict). The file is ~950 lines upstream and grows to ~1050+ with the stacked patches.

## Extension Points

### How to add new effects
To extend the compositor with additional visual effects:
1. **Add GLSL strings** to the overlay patch (or create a new overlay)
2. **Add GObject properties** with getter/setter pairs in `shell-blur-effect.c/.h`
3. **Wire uniforms** in `update_brightness()` or create a new pipeline function
4. **Expose to JS** via GObject introspection (automatic for GObject properties)
