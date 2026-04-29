# Testing — blur-my-glass

> Last mapped: 2026-04-29

## Testing Strategy

blur-my-glass has **no automated test suite of its own**. Testing is entirely manual and visual — which is inherent to the nature of the project (compositor-level shader patches that produce visual effects).

## Current Verification Approach

### Build Verification

The primary automated check is whether the patched source compiles:

```bash
# Default build (base patch only)
makepkg -si

# With liquid glass overlay
BLUR_PATCH=liquid_glass_compositor makepkg -si
```

A successful `meson compile` confirms:
- Patches apply cleanly to upstream source
- No C compilation errors or warnings from patched code
- GObject property registrations are valid
- GLSL strings are syntactically correct (as C string literals)

### Visual Verification (Manual)

Per the roadmap Phase 5 success criteria:

1. **Rounded corners**: Visually smooth at radii 0, 12, 24, 48 px
2. **Anti-aliasing**: No pixel-stepping or jagged edges at any zoom level
3. **Liquid glass refraction**: Warped background visible through blur region
4. **Specular highlights**: Border glow and top-light gloss visible
5. **No regression**: Existing blur-my-shell functionality unaffected

### Patch Integrity Verification

```bash
# Verify overlay contains only refraction-specific code
grep -c "refract\|r_transition\|r_border\|r_gradient\|specular\|gloss" \
  patches/liquid_glass_compositor.patch
# Expected: 25 refraction-specific references

# Verify zero duplication between base and overlay
# (overlay context lines should match base-patched code, but no duplicated additions)
```

## Upstream Test Suite

The GNOME Shell source tree includes tests that are **disabled** in the PKGBUILD (`-D tests=false`):

```
src/gnome-shell/tests/
├── data/                    # Test fixtures
├── dbusmock-templates/      # D-Bus mock templates
├── shell/                   # Shell integration tests
├── unit/                    # Unit tests
├── meson.build              # Test build configuration
├── gnomeshell_dbusrunner.py # Test runner
```

These upstream tests are not relevant to the patches (they test GNOME Shell UI behavior, not blur effects).

## Testing Gaps

| Gap | Risk | Mitigation |
|-----|------|------------|
| No shader output validation | Shader regressions only caught visually | SDF math is well-understood; changes are small and isolated |
| No automated build CI | Build breakage only caught manually | Project targets a single GNOME Shell version (50.0) |
| No multi-GPU testing | Shader may behave differently on AMD vs NVIDIA vs Intel | GLSL used is OpenGL ES 2.0 compatible (basic operations) |
| No FBO leak testing | Memory leaks in FBO lifecycle not detected | `clear_framebuffer_data()` called in all cleanup paths |
| No performance benchmarking | Additional FBO pass (mask_fb) adds GPU overhead | Single extra texture sample per fragment is negligible |

## Recommended Future Testing

1. **Screenshot comparison**: Capture framebuffer output at known corner radii, diff against reference images
2. **Build CI**: GitHub Actions with `makepkg` in an Arch Linux container
3. **Patch application test**: Verify patches apply cleanly to the target upstream tag
4. **GObject property roundtrip**: Set and get `corner-radius` and `refraction-strength` via GJS, verify values
