---
phase: 2
name: "Regenerate Liquid Glass as Overlay Patch"
wave: 1
depends_on: []
requirements: [PATCH-01, PATCH-02, PATCH-03, PATCH-04]
files_modified:
  - patches/liquid_glass_compositor.patch
  - PKGBUILD
autonomous: true
---

# Plan 01: Regenerate Liquid Glass as a Stacked Overlay Patch

<objective>
Regenerate `patches/liquid_glass_compositor.patch` so it applies **on top of** the base
`rounded_corners_mask.patch` (already AA-fixed in Phase 1), adding only the refraction,
specular, and lighting features. Update `PKGBUILD` to apply both patches in stacked order
when the liquid glass variant is selected.
</objective>

<context>
## Current Problem

The liquid glass patch (`liquid_glass_compositor.patch`) is a **standalone** patch against
upstream GNOME Shell 50.0. It duplicates everything from the base patch (mask GLSL, mask_fb
FBO, corner-radius property) AND adds refraction/lighting. It also reformats ~60% of the
file's code style (brace placement, function signatures, whitespace), inflating the diff
to 1656 lines.

## Target Architecture

```
upstream gnome-shell 50.0
  └── rounded_corners_mask.patch   (base: AA mask, mask_fb, corner-radius)
        └── liquid_glass_compositor.patch   (overlay: refraction, specular, lighting)
```

The overlay patch must:
1. Assume the base patch is already applied (mask infrastructure exists)
2. Add ONLY: refraction GLSL strings, refraction-strength property, refraction uniforms,
   brightness_glsl lighting additions, and the refraction snippet in `create_brightness_pipeline`
3. Preserve upstream code style (NO reformatting of unchanged lines)

## Strategy

Rather than trying to diff-edit the 1656-line patch, we will:
1. Use `git format-patch` workflow: start from a state with the base patch applied,
   make only the refraction changes, and capture the resulting diff
2. This requires working in the gnome-shell source tree (not our repo root)

Since we don't have the actual GNOME Shell source tree checked out, we'll manually
construct the overlay patch by identifying exactly which additions the liquid glass patch
makes **beyond** what the base patch already provides, and writing the overlay diff by hand.
</context>

<tasks>

<task id="01" type="research">
<title>Identify refraction-only additions in liquid glass patch</title>

<read_first>
- patches/liquid_glass_compositor.patch (full file — identify all hunks)
- patches/rounded_corners_mask.patch (base — what's already provided)
</read_first>

<action>
Compare the two patches systematically. Identify every addition in the liquid glass patch
that is NOT present in the base patch. Categorize them:

**A. New GLSL shader strings (refraction-only):**
- `refraction_decl_glsl` — uniforms for refraction
- `refraction_pre_glsl` — the SDF box-lens refraction logic
- Additions to `brightness_glsl` — border highlight and gradient lighting

**B. New struct members:**
- `refract_size_uniform`, `refract_radius_uniform`, `refraction_strength_uniform`
- `refraction_strength` (float field)

**C. New property:**
- `PROP_REFRACTION_STRENGTH` enum value
- `g_param_spec_float("refraction-strength", ...)` registration
- get/set property handlers
- getter/setter functions

**D. Modified functions:**
- `create_brightness_pipeline()` — add refraction snippet
- `update_brightness()` — add refraction uniform setting
- `shell_blur_effect_init()` — add refraction uniform lookups

**E. Code style reformatting (DISCARD):**
- Brace placement changes (`{` on same line vs next line)
- Function signature reformatting
- Whitespace changes in unchanged logic
- These are NOT included in the overlay patch
</action>

<acceptance_criteria>
- Complete categorized list of refraction-only changes
- Clear separation from already-base-patched code
- Clear separation from style-only reformatting
</acceptance_criteria>
</task>

<task id="02" type="execute">
<title>Write the overlay patch</title>

<read_first>
- Results from task 01
- patches/rounded_corners_mask.patch (to know the post-base-patch line numbers)
</read_first>

<action>
Create a new `patches/liquid_glass_compositor.patch` (overwriting the existing one) that
applies on top of the base patch. The patch must use standard unified diff format with
correct context lines matching the post-base-patch state of `shell-blur-effect.c`.

The overlay patch adds these changes to the already-base-patched file:

**1. GLSL strings (after the existing mask_glsl, before #define MIN_DOWNSCALE_SIZE):**
- Add `refraction_decl_glsl` string (refraction uniforms + shared lighting outputs)
- Add `refraction_pre_glsl` string (box-lens refraction logic)
- Modify `brightness_glsl` to include border highlight and gradient lighting lines

**2. Struct additions (after mask_size_uniform):**
- `int refract_size_uniform;`
- `int refract_radius_uniform;`
- `int refraction_strength_uniform;`
- `float refraction_strength;` (after `corner_radius`)

**3. Property enum (after PROP_CORNER_RADIUS):**
- `PROP_REFRACTION_STRENGTH,`

**4. create_brightness_pipeline() modification:**
- After the existing brightness snippet, add refraction snippet via
  `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP`

**5. update_brightness() modification:**
- Add refraction_strength, refract_size, and refract_radius uniform updates

**6. Property registration, get/set handlers:**
- Add `PROP_REFRACTION_STRENGTH` case to get_property/set_property
- Add `g_param_spec_float("refraction-strength", ...)` in class_init
- Add getter/setter functions at end of file

**7. shell_blur_effect_init() additions:**
- `self->refraction_strength = 0.f;`
- Uniform location lookups for refraction uniforms

**8. Header file (shell-blur-effect.h):**
- Add getter/setter declarations for refraction_strength

CRITICAL: Every context line in the patch must match the post-base-patch state exactly.
Use the base patch to compute what the file looks like after it's applied, then write
hunks that modify that state.

CRITICAL: Preserve upstream GNOME Shell code style in all new code (spaces before parens
in function calls, braces on next line for multi-line blocks, etc.)
</action>

<acceptance_criteria>
- patches/liquid_glass_compositor.patch exists and is a valid unified diff
- The patch does NOT contain mask_glsl, mask_glsl_declarations, mask_fb, mask_pipeline,
  mask_node, update_mask_uniforms, update_mask_fbo, corner-radius property, or any other
  code already in the base patch
- The patch DOES contain: refraction_decl_glsl, refraction_pre_glsl, refraction_strength,
  PROP_REFRACTION_STRENGTH, refract_size_uniform
- No upstream code style reformatting (no brace-style changes, no whitespace-only hunks)
- Patch header uses standard `diff --git` format
</acceptance_criteria>
</task>

<task id="03" type="execute">
<title>Update PKGBUILD for stacked patch application</title>

<read_first>
- PKGBUILD (current prepare() function)
</read_first>

<action>
Modify the `PKGBUILD` `prepare()` function to support stacked patching:

**Current behavior:** Applies ONE patch selected by `BLUR_PATCH` env var.

**New behavior:**
- ALWAYS apply the base patch (`rounded_corners_mask.patch`) first
- If `BLUR_PATCH=liquid_glass_compositor`, ALSO apply the overlay patch on top

Update the `prepare()` function:

```bash
prepare() {
  # Inject gvc
  ln -sf libgnome-volume-control gvc

  cd gnome-shell

  # Always apply the base patch (AA rounded corners mask)
  echo ":: Applying base patch: rounded_corners_mask.patch"
  patch -p1 -i "$startdir/patches/rounded_corners_mask.patch"

  # Conditionally apply overlay patch
  if [[ "${BLUR_PATCH:-}" == "liquid_glass_compositor" ]]; then
    echo ":: Applying overlay patch: liquid_glass_compositor.patch"
    patch -p1 -i "$startdir/patches/liquid_glass_compositor.patch"
  fi
}
```

Also update the `_patch` and `_patchfile` variables comment block to reflect the new
stacked architecture. Remove the old single-patch selection logic.
</action>

<acceptance_criteria>
- PKGBUILD prepare() always applies rounded_corners_mask.patch
- PKGBUILD prepare() conditionally applies liquid_glass_compositor.patch on top
- `makepkg` (default) applies only the base patch
- `BLUR_PATCH=liquid_glass_compositor makepkg` applies base + overlay
- Old `_patchfile` single-patch logic is removed
</acceptance_criteria>
</task>

</tasks>

<verification>
1. `grep -c 'refraction_decl_glsl\|refraction_pre_glsl\|refraction_strength' patches/liquid_glass_compositor.patch` — returns matches
2. `grep -c 'mask_glsl_declarations\|create_mask_pipeline\|update_mask_uniforms\|update_mask_fbo\|PROP_CORNER_RADIUS' patches/liquid_glass_compositor.patch` — returns 0 (no base code)
3. `grep 'rounded_corners_mask.patch' PKGBUILD` — returns match in prepare()
4. `grep 'liquid_glass_compositor.patch' PKGBUILD` — returns match in conditional
5. `wc -l patches/liquid_glass_compositor.patch` — should be dramatically smaller than the current 1656 lines
</verification>

<must_haves>
- Overlay patch applies only refraction/specular/lighting changes
- No duplicated base patch infrastructure
- No upstream code style reformatting
- PKGBUILD stacks patches correctly
- Both `makepkg` and `BLUR_PATCH=liquid_glass_compositor makepkg` invocations described in ROADMAP work
</must_haves>
