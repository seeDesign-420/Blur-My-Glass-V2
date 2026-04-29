# Integrations — blur-my-glass

> Last mapped: 2026-04-29

## Overview

blur-my-glass is a system package that patches GNOME Shell's C source. It has no external API calls, no databases, no auth providers. Its integrations are entirely with the GNOME/Mutter compositor stack and downstream GNOME Shell extensions.

## Upstream Integration: GNOME Shell 50.0

### Source Relationship

The project patches `src/shell-blur-effect.c` and `src/shell-blur-effect.h` from the upstream GNOME Shell repository (`https://gitlab.gnome.org/GNOME/gnome-shell.git`, tag `50.0`).

**Patched API surface:**

| GObject Property | Type | Range | Added By |
|-----------------|------|-------|----------|
| `corner-radius` | `float` | `0.0 → G_MAXFLOAT` | Base patch |
| `refraction-strength` | `float` | `0.0 → 2.0` | Liquid glass overlay |

These properties are exposed via GObject introspection and accessible from JavaScript (GJS) in GNOME Shell extensions.

### Cogl Pipeline Integration

Both patches inject GLSL shader code via Cogl snippet hooks:

| Hook | Snippet | Purpose |
|------|---------|---------|
| `COGL_SNIPPET_HOOK_FRAGMENT` | `mask_glsl` | SDF-based rounded rectangle alpha mask |
| `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP` | `refraction_replace_glsl` | UV-space refraction with `textureGrad` |
| `COGL_SNIPPET_HOOK_FRAGMENT` | `brightness_glsl` | Brightness + border highlight + gloss |

### FBO Chain

The patches add a `mask_fb` framebuffer data structure to the existing FBO pipeline:

```
actor_fb → blur_node → brightness_fb → mask_fb → final output
```

The mask FBO is the terminal stage, applying the SDF-based rounded corner clip to the composited blur+brightness result.

## Downstream Consumer: blur-my-shell Extension

The primary consumer of the added GObject properties is the [blur-my-shell](https://github.com/aunetx/blur-my-shell) GNOME Shell extension. It sets `corner-radius` (and optionally `refraction-strength`) on `Shell.BlurEffect` instances via JavaScript:

```javascript
// In blur-my-shell extension code
let effect = new Shell.BlurEffect({
    mode: Shell.BlurMode.BACKGROUND,
    radius: 30,
    brightness: 0.6,
    'corner-radius': 24.0,           // ← from base patch
    'refraction-strength': 0.3,       // ← from liquid glass overlay
});
```

Without the patched GNOME Shell, these properties don't exist and the extension falls back to sharp-cornered rectangular blur.

## Subproject Dependencies

The GNOME Shell build system uses Meson subprojects, vendored as bare Git repos:

| Subproject | Path | Integration |
|-----------|------|-------------|
| `libgnome-volume-control` (gvc) | `libgnome-volume-control/` → symlinked as `gvc` | PulseAudio volume mixer |
| `jasmine-gjs` | `jasmine-gjs/` | GJS unit test runner |
| `libshew` | `libshew/` | Shell extension host library for sandboxed prefs |

These are standard GNOME Shell subprojects and are not modified by blur-my-glass patches.

## System Integration

### Package Manager (pacman)

- Installs as `gnome-shell-rounded-blur` with `provides=('gnome-shell')`
- Conflicts with stock `gnome-shell` and `gnome-shell-debug`
- Links against `libmutter-18.so` (Mutter 18 ABI)
- Sets Mutter experimental features via GSettings override:
  - `scale-monitor-framebuffer`
  - `variable-refresh-rate`
  - `xwayland-native-scaling`

### Session Lifecycle

After installation, requires session restart (logout/login or reboot) to activate the patched GNOME Shell binary.

## External Services

**None.** This project has no network calls, no telemetry, no remote APIs. Everything is local compilation and system package management.
