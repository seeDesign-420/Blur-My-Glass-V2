# Conventions

> Mapped: 2026-04-26 (refreshed — reflects Phase 1+2 changes)

## Code Style

### C Code (Patch Target)

Both patches now **follow upstream GNOME Shell style** consistently:
- Function braces on new line
- Space before parentheses: `if (condition)`, `function_call (arg)`
- Aligned parameter indentation
- `G_UNLIKELY()` macros for cold paths
```c
static CoglPipeline*
create_mask_pipeline (void)
{
  static CoglPipeline *mask_pipeline = NULL;

  if (G_UNLIKELY (mask_pipeline == NULL))
  {
    CoglSnippet *snippet;
    mask_pipeline = create_base_pipeline ();
    ...
  }
}
```

### GLSL Shader Code
- Inline strings in C, concatenated with `\\n` line terminators
- Right-padded with spaces to align `\\n` terminators visually
- Uniform naming: `u_` prefix for uniforms (`u_corner_radius`, `u_size`)
- Fragment-local variables: `r_` prefix for refraction temporaries (`r_sd`, `r_transition`, `r_border`)

### Bash Scripts
- `set -euo pipefail` — strict mode
- Color-coded output functions: `info()`, `ok()`, `warn()`, `err()`, `die()`
- Argument parsing via `for arg in "$@"; case` loop
- Array-based dependency checking pattern

### PKGBUILD
- Follows Arch Linux packaging standards
- `pkgbase` / `pkgname` array for split packages (main + docs)
- Epoch versioning (`epoch=1`) for version ordering
- Standard `prepare()` → `build()` → `package_*()` functions

## Naming Patterns

| Context | Convention | Example |
|---------|-----------|---------|
| C functions | `snake_case` with prefix | `shell_blur_effect_set_corner_radius()` |
| C struct members | `snake_case` | `self->corner_radius`, `self->mask_fb` |
| GObject properties | kebab-case strings | `"corner-radius"`, `"refraction-strength"` |
| Property enum values | `PROP_UPPER_SNAKE` | `PROP_CORNER_RADIUS` |
| GLSL uniforms | `u_` prefix | `u_corner_radius`, `u_refract_size` |
| GLSL locals (refraction) | `r_` prefix | `r_sd`, `r_transition` |
| Patch files | `snake_case` | `rounded_corners_mask.patch` |
| Package names | kebab-case | `gnome-shell-rounded-blur` |

## Error Handling

### C Layer
- GObject property validation: `g_return_if_fail (SHELL_IS_BLUR_EFFECT (self))`
- FBO creation failure: `goto fail` → fallback to unblurred actor painting
- Pipeline errors: `g_warning()` for non-fatal offscreen buffer failures
- Value clamping: `MAX (0.f, corner_radius)`, `CLAMP (refraction_strength, 0.f, 2.f)`

### Bash Layer
- `die()` for fatal errors (missing `makepkg`, missing patch file)
- `warn()` for recoverable conditions (missing makedepends)
- Preflight checks before build (distro check, patch file existence)

## GObject Patterns

All new functionality follows the standard GObject property lifecycle:
1. **Define** property spec in `_class_init()` with `g_param_spec_float()`
2. **Register** via `g_object_class_install_properties()`
3. **Handle** get/set in `_get_property()` / `_set_property()` switch
4. **Expose** getter/setter functions with `g_return_*_if_fail()` guards
5. **Notify** changes via `g_object_notify_by_pspec()`
6. **Invalidate** cache flags and `clutter_effect_queue_repaint()` on change

## Patch Discipline

### Stacked Architecture
- **Base patch** (`rounded_corners_mask.patch`): Self-contained against upstream, always applied first
- **Overlay patch** (`liquid_glass_compositor.patch`): Applied on top of base, adds refraction-only code
- Both patches must preserve upstream GNOME Shell code style (no reformatting)
- Context lines in overlay must match post-base-patch file state exactly

### File Management
- Patches are maintained in `patches/` (the canonical source of truth)
- Build applies patches directly from `$startdir/patches/` (no more `cp` to `$srcdir`)
- The `.gitignore` excludes all build artifacts, keeping the repo minimal (5 tracked files)

## Commit Conventions

AI commits include:
```
Co-Authored-By: Antigravity <noreply@example.com>
```
