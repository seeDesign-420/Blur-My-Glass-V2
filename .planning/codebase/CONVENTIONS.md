# Conventions — blur-my-glass

> Last mapped: 2026-04-29

## Code Style

### C Code (Patches)

All C code in patches follows **GNOME/GLib coding conventions** exactly — this is mandatory because patches must apply cleanly to upstream and must not reformat unchanged lines.

Key conventions observed in `shell-blur-effect.c`:

```c
// Brace style: opening brace on new line for function bodies
static CoglPipeline*
create_mask_pipeline (void)
{
  static CoglPipeline *mask_pipeline = NULL;

  if (G_UNLIKELY (mask_pipeline == NULL))
  {
    // ...
  }

  return cogl_pipeline_copy (mask_pipeline);
}

// Pointer style: space before asterisk
CoglPipeline *pipeline;
ShellBlurEffect *self;

// GObject property pattern: enum + g_param_spec + install
properties[PROP_CORNER_RADIUS] =
  g_param_spec_float ("corner-radius", NULL, NULL,
                      0.f, G_MAXFLOAT, 0.f,
                      G_PARAM_READWRITE | G_PARAM_STATIC_STRINGS | G_PARAM_EXPLICIT_NOTIFY);

// Return guards
g_return_val_if_fail (SHELL_IS_BLUR_EFFECT (self), 0.f);
g_return_if_fail (SHELL_IS_BLUR_EFFECT (self));
```

### GLSL Shader Strings

Embedded as C string literal arrays with consistent formatting:

```c
static const gchar *mask_glsl =
"  vec2 uv = cogl_tex_coord_in[0].st;                                      \n"
"  vec2 p  = uv * u_size;                                                  \n"
"  vec2 q  = abs(p - 0.5 * u_size) - (0.5 * u_size - u_corner_radius);     \n";
```

- Each line is a separate C string literal (auto-concatenated)
- Trailing `\n` with consistent right-padding (80-column alignment)
- Two-space indentation within shader code
- Comments use `/* */` style inline

### Bash Scripts

- `set -euo pipefail` at top of `install.sh`
- Color-coded output functions: `info()`, `ok()`, `warn()`, `err()`, `die()`
- Arguments parsed via `for arg in "$@"; case` pattern
- Consistent quoting: `"$variable"`, `"${array[@]}"`

### PKGBUILD

- Standard Arch Linux PKGBUILD conventions
- Array style: one element per line for readability
- Comments document the stacked patch architecture

## Patch Writing Conventions

### Context Lines

Patches use standard unified diff format. The overlay patch's context lines reference code introduced by the base patch — establishing a dependency order.

### Requirement: No Upstream Reformatting

**PATCH-04** requirement: patches must not reformat unchanged upstream lines. Only lines that are functionally modified should appear as changes.

### Patch Naming

- `rounded_corners_mask.patch` — descriptive `snake_case` matching feature name
- `liquid_glass_compositor.patch` — same pattern

## Error Handling Patterns

### C Code

```c
// GObject return guards (defensive, returns default on invalid input)
g_return_val_if_fail (SHELL_IS_BLUR_EFFECT (self), 0.f);
g_return_if_fail (SHELL_IS_BLUR_EFFECT (self));

// Uniform location checks (graceful degradation)
if (self->corner_radius_uniform > -1)
    cogl_pipeline_set_uniform_1f (...);

// FBO update chain (all-or-nothing)
updated = update_actor_fbo (self, width, height, downscale_factor) &&
          update_brightness_fbo (self, width, height, downscale_factor) &&
          update_mask_fbo (self, width, height, downscale_factor);

// Property change deduplication
if (self->corner_radius == corner_radius)
    return;
```

### Bash

```bash
set -euo pipefail          # Exit on error, undefined vars, pipe failures
die() { err "$@"; exit 1; } # Fatal error with message

# Preflight checks
if ! command -v makepkg &>/dev/null; then
  die "makepkg not found — this installer requires Arch Linux"
fi
if [[ ! -f "patches/rounded_corners_mask.patch" ]]; then
  die "Base patch not found: patches/rounded_corners_mask.patch"
fi
```

## Naming Patterns

### GLSL Uniform Prefixes

| Prefix | Scope | Examples |
|--------|-------|---------|
| `u_` | Mask pipeline uniforms | `u_corner_radius`, `u_size` |
| `u_refract_` | Refraction pipeline uniforms | `u_refract_size`, `u_refract_radius` |
| `r_` | Refraction local/global shader variables | `r_transition`, `r_border`, `r_gradient`, `r_sd` |
| (none) | Upstream uniforms | `brightness` |

### GObject Property Pattern

Each new property follows this complete pattern:
1. Enum value: `PROP_CORNER_RADIUS`
2. Struct field: `float corner_radius;`
3. Uniform handle: `int corner_radius_uniform;`
4. `get_property()` case
5. `set_property()` case
6. `g_param_spec_float()` registration
7. Public getter: `shell_blur_effect_get_corner_radius()`
8. Public setter: `shell_blur_effect_set_corner_radius()` with change guard + repaint queue
9. Header declaration

### Cache Invalidation

Property setters clear the render cache and queue a repaint:

```c
self->cache_flags &= ~BLUR_APPLIED;
if (self->actor)
    clutter_effect_queue_repaint (CLUTTER_EFFECT (self));
g_object_notify_by_pspec (G_OBJECT (self), properties[PROP_CORNER_RADIUS]);
```

## Commit Message Conventions

From git history, the project uses conventional commits:

```
feat: initial release
fix(shader): anti-alias SDF rounded corners mask
refactor(02): stacked patch architecture
docs(01): plan phase 1
docs: map existing codebase
```

Pattern: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `docs`
- Scope: phase number or component name
