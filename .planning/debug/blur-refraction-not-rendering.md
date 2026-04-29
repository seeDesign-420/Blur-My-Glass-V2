---
status: investigating
trigger: "All blur and refraction effects not rendering after rebuild as gnome-shell-rounded-blur"
created: 2026-04-26T19:47:00+02:00
updated: 2026-04-26T19:47:00+02:00
---

# Debug: Blur & Refraction Not Rendering

## Symptoms

- **Expected:** Blur effects (dash, applications, boxpointer, etc.) and liquid glass refraction should render visually on GNOME Shell
- **Actual:** Extension loads, all components enable correctly, actors are tracked — but zero visual blur or refraction renders on screen
- **Errors:** `g_object_set_is_valid_property: object class 'NativeDynamicBlurEffect' has no property named 'chromatic-aberration'` (repeated)
- **Timeline:** Worked perfectly on `gnome-shell-blur-my-glass` package. Broke after rebuilding as `gnome-shell-rounded-blur` (same PKGBUILD, renamed). Both base + liquid glass patches applied.
- **Reproduction:** Every blur component is affected — panel, dash, applications, boxpointer. Session restart does not fix.

## Prior Investigation (from main context)

### Confirmed working:
- Extension is ACTIVE (state verified)
- GSettings schema compiles, all keys present, `blur=true` for relevant components
- Fresh boot logs show: `[Blur my Shell > boxpointer] blurring popup menus`, `[BMS-DIAG] DashBlur.enable() called`, `[Blur my Shell > applications] blurring applications...`
- All JS component wiring is correct (extension.js, keys.js, prefs.js, boxpointer.js)
- Typelib has `Shell.BlurEffect` with `refraction-strength` property but NO `chromatic-aberration`

### Key findings:
- `gnome-shell-rounded-blur` package was built with liquid glass overlay (`BLUR_PATCH=liquid_glass_compositor`)
- `brightness_glsl_declarations` now includes `refraction_strength`, `u_refract_size`, `u_refract_radius` uniforms
- `brightness_glsl` adds SDF border highlight and gradient lighting
- `refraction_replace_glsl` REPLACES default texture lookup with `textureGrad` via `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP`
- Mask pipeline added as intermediate FBO for rounded corners
- The shader references `r_transition`, `r_border`, `r_gradient` computed in texture-lookup hook, consumed in fragment hook

### Suspect areas:
1. `textureGrad` replacement of default texture sampling may produce GPU-specific rendering failures
2. Division by potentially-zero uniform in GLSL: `float r_cr = u_refract_radius / u_refract_size.y;`
3. Paint node chain: mask_node → brightness_node → blur_node ordering may have framebuffer dependency issues
4. Uniform initialization timing — refract uniforms set in `update_mask_uniforms()` on `brightness_fb.pipeline`

### Key files:
- C source: `/home/thomas/blur-my-glass-live/src/gnome-shell/src/shell-blur-effect.c`
- Base patch: `/home/thomas/blur-my-glass-live/patches/rounded_corners_mask.patch`
- Liquid glass patch: `/home/thomas/blur-my-glass-live/patches/liquid_glass_compositor.patch`
- PKGBUILD: `/home/thomas/blur-my-glass-live/PKGBUILD`
- Extension effects: `/home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/effects/native_dynamic_gaussian_blur.js`
- Extension entry: `/home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/extension.js`

## Current Focus

- hypothesis: "The liquid glass compositor patch's textureGrad replacement in the brightness pipeline breaks ALL blur rendering — either due to GLSL shader compilation failure on the GPU, uninitialised uniform division-by-zero, or paint node chain misordering"
- next_action: "Isolate whether the shader compiles at all (check for cogl/GL errors at startup), then test with refraction_strength=0 vs >0 to narrow the failure surface"

## Evidence

(none yet — prior investigation was in main context)

## Eliminated

(none yet)

## Resolution

- root_cause:
- fix:
- verification:
- files_changed:
