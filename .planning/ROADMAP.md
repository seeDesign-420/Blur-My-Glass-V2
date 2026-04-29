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

## Phase 3: Actor Coverage Audit

**Goal:** Identify all GNOME Shell Clutter actors not currently wrapped with blur/glass effects and create an actionable extension plan.

**Requirements:** (new — research-driven)

**Changes:**
- Research document mapping all UI actors vs. blur coverage
- Plan document prioritizing unblurred actors for future phases

**Success criteria:**
1. Complete inventory of GNOME Shell UI actors with blur status
2. Priority-ranked list of blur targets
3. Feasibility assessment per target (JS extension vs. C patch)

---

## Phase 4: BoxPointer Blur Component

**Goal:** Add a new blur-my-shell component that applies blur/glass effects to all `BoxPointer`-based UI elements (Quick Settings, Date Menu, popup menus), with the same customizability as existing components.

**Depends on:** Phase 3

**Requirements:** BP-01 (blur), BP-02 (customization parity), BP-03 (lifecycle), BP-04 (preferences)

**Changes:**
- `components/boxpointer.js` — New blur-my-shell component (JS extension module)
- `conveniences/keys.js` — Add `boxpointer` component settings keys
- `schemas/org.gnome.shell.extensions.blur-my-shell.gschema.xml` — Add boxpointer schema
- `preferences/boxpointer.js` — New preferences page (Adw.PreferencesPage)
- `ui/boxpointer.ui` — GtkBuilder UI template for preferences
- `extension.js` — Register new component in `enable()`/`disable()`
- `prefs.js` — Register preferences page

**Success criteria:**
1. Quick Settings dropdown has blur behind it when opened
2. Date Menu / Calendar dropdown has blur behind it when opened
3. Right-click context menus have blur behind them
4. All settings match existing component parity: blur toggle, pipeline, sigma, brightness, corner-radius, refraction-strength
5. Preferences page visible in blur-my-shell settings under new "Popup Menus" section
6. Clean enable/disable lifecycle — no actor leaks, no orphaned effects
7. Works with both base patch (rounded corners only) and liquid glass overlay

---

## Phase 5: Build Verification

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

---

## Phase 6: Dhruva Dock Integration

**Goal:** Implement blur/glass effect support for the [Dhruva](https://github.com/NarkAgni/dhruva) dock extension — applying frosted glass blur to the dock background panel and its glassmorphism context menus, leveraging the `corner-radius` and `refraction-strength` properties from blur-my-glass.

**Depends on:** Phase 4, Phase 5

**Requirements:** (new — integration-driven)

**Changes:**
- Research Dhruva's Clutter actor hierarchy (dock panel, context menu, floating handle)
- Blur component or monkey-patch for Dhruva's dock background `St.Widget`
- Blur integration for Dhruva's glassmorphism context menu (likely `BoxPointer`-based, may reuse Phase 4 component)
- GSettings schema entries for Dhruva-specific blur settings (sigma, brightness, corner-radius)
- Preferences page for Dhruva dock blur configuration

**Success criteria:**
1. Dhruva dock background renders with frosted glass blur behind it
2. Dhruva context menus (right-click, Aero Peek) render with blur
3. Blur respects Dhruva's floating mode (position/size changes)
4. Works with both base patch (rounded corners) and liquid glass overlay
5. Clean enable/disable lifecycle — no interference with Dhruva's own animations
6. Preferences exposed in blur-my-shell settings under a "Dhruva Dock" section
