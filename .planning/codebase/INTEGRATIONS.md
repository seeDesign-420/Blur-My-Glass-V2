# External Integrations

*Mapped: 2026-05-03*

## Upstream GNOME Shell (C-level integration)

The core integration is a **source-level patch** applied to GNOME Shell's compositor code before compilation.

### Patched APIs

| File | Property Added | Type | Range | Purpose |
|------|---------------|------|-------|---------|
| `src/shell-blur-effect.c` | `corner-radius` | `float` | `0.0 – G_MAXFLOAT` | SDF-based anti-aliased rounded corners mask |
| `src/shell-blur-effect.c` | `refraction-strength` | `float` | `0.0 – 2.0` | Zoom-lens refraction warp (liquid glass overlay only) |

### Cogl Pipeline Hooks

| Hook | Snippet Type | Purpose |
|------|-------------|---------|
| `COGL_SNIPPET_HOOK_FRAGMENT` | `mask_glsl` | AA rounded-rect SDF mask (`smoothstep` + `fwidth`) |
| `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP` | `refraction_replace_glsl` | UV-warp refraction with `textureGrad` (liquid glass only) |
| `COGL_SNIPPET_HOOK_FRAGMENT` | `brightness_glsl` (modified) | Border highlight + vertical gradient gloss (liquid glass only) |

### FBO Pipeline

The base patch adds a third framebuffer (`mask_fb`) to the existing blur pipeline:

```
actor_fb → blur → brightness_fb → mask_fb (final output)
```

The liquid glass overlay modifies `brightness_fb`'s pipeline to include refraction + specular before the mask pass.

## blur-my-shell Extension (JS-level integration)

### Component Registration

`dhruva.js` is registered as a first-class blur-my-shell component in `extension.js`:

```javascript
// extension.js line 25, 78
import { DhruvaBlur } from './components/dhruva.js';
this._dhruva_blur = new DhruvaBlur(...init());
```

### Settings Integration

The Dhruva component binds to the `dhruva` subsection of blur-my-shell's GSettings schema:

| Setting | GSettings Key | Effect |
|---------|--------------|--------|
| `BLUR` | `blur` | Master toggle for Dhruva dock blur |
| `SIGMA` | `sigma` | Gaussian blur radius (mapped to `unscaled_radius = 2 * SIGMA`) |
| `BRIGHTNESS` | `brightness` | Brightness multiplier on blurred content |
| `CORNER_RADIUS` | `corner-radius` | SDF corner radius for the blur mask |
| `REFRACTION_STRENGTH` | `refraction-strength` | Refraction warp intensity (liquid glass only) |

Settings changes trigger a full disable/re-enable cycle for the Dhruva component (lines 684–705 of `extension.js`).

### DummyPipeline API

The Dhruva component uses `DummyPipeline` rather than `Pipeline` (no static blur support):

```javascript
// dhruva.js line 187-193
const pipeline = new DummyPipeline(this.effects_manager, this.settings.dhruva);
let [blurWidget, bgManager] = pipeline.create_background_with_effect(
    background_group, 'bms-dhruva-blurred-widget'
);
```

`DummyPipeline.create_background_with_effect()` returns:
1. `blurWidget` — `St.Widget` with `NativeDynamicBlurEffect` attached
2. `bgManager` — fake `Clutter.Actor` with `.backgroundActor` and `._bms_pipeline` references

## Dhruva Dock Extension (runtime integration)

The `DhruvaBlur` component discovers Dhruva at runtime — no compile-time dependency.

### Actor Discovery

| Method | Signal | Actor Name |
|--------|--------|------------|
| `Main.uiGroup` / `global.stage` | `child-added` | `'DhruvaContainer'` |
| Initial + timed scan | `_scan_for_docks()` at 500ms, 2s, 5s, 10s | `'DhruvaContainer'` children |
| Context menu detection | `child-added` | CSS class `'context-menu-overlay'` |

### Dhruva Actor Hierarchy (expected)

```
DhruvaContainer (Clutter.Actor, chrome)
  ├── DhruvaBackground (St.Widget) — blur target
  └── Dhruva (St.BoxLayout) — icon container
```

### Geometry Sync Signals

The blur wrapper tracks 9 properties on `DhruvaBackground` and 9 on `DhruvaContainer`:

```
notify::x, notify::y, notify::width, notify::height,
notify::scale-x, notify::scale-y,
notify::translation-x, notify::translation-y,
notify::pivot-point (bgActor only), notify::visible (container only)
```

Uses `get_transformed_position()` / `get_transformed_size()` + `parent.transform_stage_point()` for coordinate conversion.

## GNOME GitLab (source dependency)

| Repository | Tag/Commit | Purpose |
|------------|-----------|---------|
| `GNOME/gnome-shell` | `tag=50.0` | Main source tree |
| `GNOME/libgnome-volume-control` | `commit=664eba4c` | Audio control subproject |
| `ptomato/jasmine-gjs` | `commit=856465dd` | Test framework subproject |
| `GNOME/libshew` | `commit=ed782477` | Embedded widget subproject |

## No External Services

This project has **no network dependencies** at runtime:
- No REST APIs, databases, webhooks, or cloud services
- No authentication providers
- No telemetry or analytics
- All integration is through GObject introspection bindings and Clutter/Cogl GPU pipelines
