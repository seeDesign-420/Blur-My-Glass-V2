# Roadmap — v1.0 Anti-Aliased Unified Patches

## Phase 1: Fix SDF Anti-Aliasing

**Goal:** Backport the correct SDF + anti-aliasing from the liquid glass patch into the rounded corners patch.

**Requirements:** SDF-01, SDF-02, SDF-03

**Changes:**
- `patches/rounded_corners_mask.patch` — update `mask_glsl` shader string

**Success criteria:**
1. `dist` calculation includes interior SDF term: `min(max(q.x, q.y), 0.0)`
2. `step()` replaced with `smoothstep(aa, -aa, dist)` where `aa = max(fwidth(dist), 0.75)`
3. Patch applies cleanly to upstream GNOME Shell 50.0 source
4. Patched shell compiles without warnings

---

## Phase 2: Stacked Patch Architecture

**Goal:** Restructure from two independent patches into a stacked base + overlay system.

**Requirements:** PATCH-01, PATCH-02, PATCH-03, PATCH-04

**Changes:**
- `patches/rounded_corners_mask.patch` — becomes the **base patch** (already contains AA-fixed mask)
- `patches/liquid_glass_compositor.patch` — regenerate as an **overlay** that applies on top of the base, adding only refraction/specular/lighting
- `PKGBUILD` — update `prepare()` to apply base patch, then conditionally apply overlay
- `install.sh` — no changes needed (flag logic stays the same)

**Success criteria:**
1. Base patch contains only: mask GLSL, `mask_fb` FBO, `corner-radius` property, upstream code style
2. Overlay patch contains only: refraction GLSL, `refraction-strength` property, lighting snippets
3. `makepkg` with default env builds successfully (base only)
4. `BLUR_PATCH=liquid_glass_compositor makepkg` builds successfully (base + overlay)
5. No upstream code reformatting in either patch

---

## Phase 3: Build Verification

**Goal:** End-to-end build and visual verification of both patch variants.

**Requirements:** VFY-01, VFY-02, VFY-03

**Steps:**
1. Clean build with default patch → install → verify AA corners
2. Clean build with `--liquid-glass` → install → verify refraction + AA corners
3. Test `install.sh` flow for both modes

**Success criteria:**
1. Rounded corners are visually smooth at radii 0, 12, 24, 48 px
2. Liquid glass refraction and specular effects render identically to current behavior
3. `./install.sh` and `./install.sh --liquid-glass` both complete successfully
