# Integrations

*Last mapped: 2026-04-29*

## Upstream GNOME Shell (Source-Level)

The primary integration is a **source-level patch** applied to upstream GNOME Shell 50.0 at build time.

### Patched Files
| File | Patch | What Changes |
|------|-------|-------------|
| `src/shell-blur-effect.c` | `rounded_corners_mask.patch` | Adds `corner-radius` GObject property, SDF mask FBO pass, GLSL `smoothstep`+`fwidth` anti-aliasing |
| `src/shell-blur-effect.h` | `rounded_corners_mask.patch` | Exposes `get/set_corner_radius()` API |
| `src/shell-blur-effect.c` | `liquid_glass_compositor.patch` | Adds `refraction-strength` property, `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP` refraction shader, specular/border/gradient highlights |
| `src/shell-blur-effect.h` | `liquid_glass_compositor.patch` | Exposes `get/set_refraction_strength()` API |

### Stacked Patch Architecture
```
Upstream GNOME Shell 50.0
  └── rounded_corners_mask.patch  (always applied)
        └── liquid_glass_compositor.patch  (conditionally applied)
```
The base patch is self-contained. The overlay depends on the base's `mask_fb` FBO and `corner-radius` infrastructure.

## Mutter / Cogl GPU Pipeline

### GObject Properties Exposed
| Property | Type | Range | Patch |
|----------|------|-------|-------|
| `corner-radius` | float | 0..MAXFLOAT | Base |
| `refraction-strength` | float | 0..2.0 | Overlay |

### Cogl Snippet Hooks Used
- `COGL_SNIPPET_HOOK_FRAGMENT` — SDF mask shader (base patch)
- `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP` — Refraction shader with `textureGrad` (overlay patch)

### FBO Render Passes (paint order)
1. **actor_fb** — Captures the actor content
2. **background_fb** — Captures the screen behind the actor
3. **brightness_fb** — Applies brightness + refraction texture lookup (overlay)
4. **mask_fb** — Applies SDF rounded corners mask (base)

## blur-my-shell Extension (Consumer)

The GNOME Shell extension at `~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/` consumes the patched `Shell.BlurEffect` via GObject property access.

### Component → Patch Property Mapping
| Component | `corner-radius` | `refraction-strength` |
|-----------|------------------|-----------------------|
| BoxPointer (`components/boxpointer.js`) | ✅ | ✅ (via DummyPipeline) |
| Dhruva (`components/dhruva.js`) | ✅ | ✅ (via DummyPipeline) |
| Panel, Overview, Dash, etc. | ✅ (upstream blur-my-shell) | ✅ (upstream blur-my-shell) |

### DummyPipeline Integration (`conveniences/dummy_pipeline.js`)
- Creates `St.Widget` with `NativeDynamicBlurEffect` (subclass of `Shell.BlurEffect`)
- Sets `corner-radius`, `refraction-strength` via GObject properties
- Falls back gracefully if patched properties don't exist (try/catch)
- Connects to GSettings `changed::*` signals for live updates

### NativeDynamicBlurEffect (`effects/native_dynamic_gaussian_blur.js`)
- GObject subclass of `Shell.BlurEffect` registered as `NativeDynamicBlurEffect`
- Handles HiDPI scaling via `St.ThemeContext.scale_factor`
- Safe setters for `refraction-strength` and `chromatic-aberration` — no-op if patch not installed

## Third-Party Extensions

### Dhruva Dock (`components/dhruva.js`)
- **Discovery:** Runtime detection via `child-added` on `Main.uiGroup` and `global.stage`
- **Actor structure:** `DhruvaContainer` → `DhruvaBackground` (blur target) + `Dhruva` (icon box)
- **Integration pattern:** DummyPipeline blur injected as sibling behind `DhruvaBackground`
- **Load-order handling:** Delayed re-scans at 500ms, 2s, 5s, 10s intervals
- **Context menus:** Detected via `context-menu-overlay` CSS class, blur injected behind `DrawingArea`

### BoxPointer / Popup Menus (`components/boxpointer.js`)
- **Integration pattern:** Monkey-patches `BoxPointer.prototype.open/close`
- **Blur placement:** Sibling widget in BoxPointer's parent, positioned to match drawn rectangle (excluding arrow)
- **Geometry tracking:** Reads `-arrow-rise`, `-arrow-border-radius` from theme node
- **Background override:** Optionally sets `-arrow-background-color: transparent` for see-through effect

## Arch Linux Package Manager

- `provides=('gnome-shell')` — Satisfies all packages depending on gnome-shell
- `conflicts=('gnome-shell' 'gnome-shell-debug')` — Prevents dual installation
- GSettings schema override installed to `/usr/share/glib-2.0/schemas/`
