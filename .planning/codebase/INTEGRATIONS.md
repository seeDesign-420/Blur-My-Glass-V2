# External Integrations

> Mapped: 2026-04-26 (refreshed)

## Overview

blur-my-glass has minimal external integrations — it's a self-contained patch-and-build project. All integrations are with the GNOME platform and the Arch Linux packaging ecosystem.

## Upstream Source Repositories

| Repository | URL | Purpose | Pinned |
|-----------|-----|---------|--------|
| GNOME Shell | `https://gitlab.gnome.org/GNOME/gnome-shell.git` | Primary source to patch | Tag `50.0` |
| libgnome-volume-control | `https://gitlab.gnome.org/GNOME/libgnome-volume-control.git` | Subproject dependency | Commit `664eba4c` |
| jasmine-gjs | `https://github.com/ptomato/jasmine-gjs.git` | Test framework subproject | Commit `856465dd` |
| libshew | `https://gitlab.gnome.org/GNOME/libshew.git` | Subproject dependency | Commit `ed782477` |

## Compositor APIs

### Mutter / Cogl Pipeline System
The patch integrates at the **Cogl pipeline level**, which is Mutter's GPU abstraction:

- **`CoglPipeline`** — GPU rendering pipeline objects
- **`CoglSnippet`** — GLSL shader injection points (`COGL_SNIPPET_HOOK_FRAGMENT`, `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP`)
- **`CoglFramebuffer`** / **`CoglOffscreen`** — FBO management for multi-pass rendering
- **`ClutterPaintNode`** — Scene graph paint node tree (layer, blur, blit, pipeline nodes)
- **`ClutterEffect`** — Base class for `ShellBlurEffect`

### GObject Introspection
All new properties (`corner-radius`, `refraction-strength`) are exposed via GObject property system, making them accessible from:
- GJS (JavaScript extension code like blur-my-shell)
- GSettings bindings
- DBus introspection

## Downstream Consumers

| Consumer | Integration Point |
|----------|------------------|
| **blur-my-shell** extension | Sets `corner-radius` and optionally `refraction-strength` on `ShellBlurEffect` instances |
| **GSettings** | Potential schema bindings for runtime control of refraction parameters |

## Package Distribution

| Channel | Format | Details |
|---------|--------|---------|
| GitHub | Source | `https://github.com/seeDesign-420/blur-my-glass` |
| Local | `*.pkg.tar.zst` | Built via `makepkg`, installed with `pacman -U` |
| AUR (potential) | PKGBUILD | Compatible format, not yet published |

## No External Services

- No network APIs, databases, or webhooks
- No CI/CD pipeline (no `.github/workflows/` or equivalent)
- No telemetry or analytics
- No authentication providers
