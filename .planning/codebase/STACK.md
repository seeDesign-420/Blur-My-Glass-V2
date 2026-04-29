# Technology Stack

*Last mapped: 2026-04-29*

## Languages

| Language | Role | Files |
|----------|------|-------|
| **C** | Compositor patches — GLSL shader injection into `shell-blur-effect.c/.h` | `patches/*.patch` → applied to `src/gnome-shell/src/shell-blur-effect.{c,h}` |
| **GLSL** | SDF mask + refraction shaders (embedded as C string literals in patches) | Inline in `rounded_corners_mask.patch`, `liquid_glass_compositor.patch` |
| **JavaScript (GJS)** | GNOME Shell extension — blur-my-shell component layer | `~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/` |
| **Bash** | Build orchestration + installer | `install.sh`, `PKGBUILD` |

## Runtime

- **GNOME Shell 50** — Wayland compositor, GJS runtime for extensions
- **Mutter 18 API** (`libmutter-18.so`) — Clutter scene graph, Cogl GPU pipeline
- **GJS** — GNOME's JavaScript engine (SpiderMonkey-based), runs extension JS
- **GObject Introspection** — GI bindings for `Shell`, `St`, `Clutter`, `Meta`, `GLib`

## Build System

- **makepkg** (Arch Linux) — Drives the entire build via `PKGBUILD`
- **Meson + Ninja** — GNOME Shell's native build system (invoked by `arch-meson`)
- **patch** — Applies `.patch` files to upstream source in `prepare()`
- **CFLAGS:** `-O3 -fno-semantic-interposition`
- **LDFLAGS:** `-Wl,-Bsymbolic-functions`

## Dependencies

### Runtime Dependencies (from `PKGBUILD`)
Core: `mutter`, `gjs`, `gtk4`, `libadwaita`, `cairo`, `glib2`, `pango`, `graphene`
System: `gnome-session`, `gnome-settings-daemon`, `gsettings-desktop-schemas`, `dconf`
Media: `libpipewire`, `libpulse`, `libcanberra-pulse`
Auth: `gcr-4`, `polkit`, `libsecret`
Network: `libnm`, `libnma-gtk4`, `libsoup3`
Other: `accountsservice`, `ibus`, `upower`, `webkitgtk-6.0`

### Build Dependencies
`git`, `meson`, `gobject-introspection`, `glib2-devel`, `gi-docgen`, `sassc`, `python-docutils`, `asciidoc`, `bash-completion`, `evolution-data-server`, `gnome-keybindings`

### Subproject Sources (pinned commits)
- `libgnome-volume-control` (GNOME GitLab, commit `664eba4c`)
- `jasmine-gjs` (GitHub ptomato, commit `856465dd`)
- `libshew` (GNOME GitLab, commit `ed782477`)

## Configuration

### Build-Time Configuration
- **`BLUR_PATCH` env var** — selects patch variant:
  - Unset/empty → base only (rounded corners mask)
  - `liquid_glass_compositor` → base + liquid glass overlay
- **`meson_options`** — `-D gtk_doc=true -D tests=false`
- **Epoch:** `1` (for upgrade path from stock `gnome-shell`)

### Runtime Configuration
- **GSettings overrides** — `30_org.archlinux.gnome-shell-rounded-blur.gschema.override`
  - Enables `scale-monitor-framebuffer`, `variable-refresh-rate`, `xwayland-native-scaling`
- **blur-my-shell GSettings** — Extension preferences (sigma, brightness, corner-radius, refraction-strength per component)

## Packaging

- **Package name:** `gnome-shell-rounded-blur` (provides `gnome-shell`, conflicts with `gnome-shell`)
- **Docs package:** `gnome-shell-rounded-blur-docs` (API documentation)
- **Version:** `50.0` (epoch `1:50.0-1`)
- **Output:** `gnome-shell-rounded-blur-1:50.0-1-x86_64.pkg.tar.zst`
