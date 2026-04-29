# Tech Stack — blur-my-glass

> Last mapped: 2026-04-29

## Languages

| Language | Role | Files |
|----------|------|-------|
| **C** | Core — patched source files (`shell-blur-effect.c`, `.h`) | 2 patched files (1276 LOC combined) |
| **GLSL** | Shader code embedded as C string literals | Inline in `shell-blur-effect.c` |
| **Bash** | Build orchestration, installation | `install.sh` (123 LOC), `PKGBUILD` (167 LOC) |
| **Meson** | Upstream GNOME Shell build system | `src/gnome-shell/meson.build` (inherited) |
| **Unified Diff** | Patch deliverables | `patches/*.patch` (562 LOC total) |

## Runtime / Target Environment

- **Desktop:** GNOME 50 on Wayland
- **Compositor:** Mutter 18 API (`libmutter-18.so`)
- **GPU API:** OpenGL ES via Cogl (Mutter's GPU abstraction)
- **GObject Runtime:** GLib 2.86+, GJS 1.87+
- **Distribution:** Arch Linux (or Arch-based derivatives)

## Build System

| Tool | Version Req | Purpose |
|------|-------------|---------|
| `makepkg` | Arch native | Package builder — drives entire build |
| `meson` | ≥ 1.3.0 | GNOME Shell's build system |
| `ninja` | (via meson) | Actual compilation driver |
| `gcc` | system | C compiler with `-O3 -fno-semantic-interposition` |
| `sassc` | any | SASS→CSS compilation for GNOME Shell themes |
| `patch` | system | Applies `.patch` files in `prepare()` |
| `git` | any | Source checkout from GNOME GitLab |

### Build Flow

```
install.sh → makepkg (PKGBUILD)
  → prepare(): git clone + patch -p1
  → build(): meson setup + meson compile
  → package(): meson install → .pkg.tar.zst
  → pacman -U: replaces system gnome-shell
```

## Key Dependencies (Runtime)

From `PKGBUILD` `depends=()`:

| Dependency | Role |
|-----------|------|
| `mutter` | Compositor framework — provides Clutter, Cogl, MTK |
| `gjs` | JavaScript engine for GNOME Shell UI |
| `gtk4` | GTK 4 widget toolkit |
| `libadwaita` | Adaptive UI library |
| `cairo` / `pango` | 2D rendering / text layout |
| `graphene` | GPU-oriented math types (used by Clutter) |
| `libpipewire` / `libpulse` | Audio/screen recording |
| `polkit` / `libsecret` | Privilege elevation / secrets |

## Key Dependencies (Build-time)

From `PKGBUILD` `makedepends=()`:

| Dependency | Role |
|-----------|------|
| `gobject-introspection` | GIR generation for JS bindings |
| `gi-docgen` | API documentation generation |
| `glib2-devel` | GLib build headers |
| `evolution-data-server` | Calendar integration (optional module) |

## Source Repositories (Vendored via Git)

| Repo | Commit/Tag | Purpose |
|------|-----------|---------|
| `gnome-shell` | tag `50.0` | Main source being patched |
| `libgnome-volume-control` | `664eba4c` | Audio control subproject |
| `jasmine-gjs` | `856465dd` | GJS test framework subproject |
| `libshew` | `ed782477` | Shell extensions host library |

## Configuration

- No runtime configuration files in this repo — configuration is compile-time via patch selection
- `BLUR_PATCH` environment variable selects patch variant at build time:
  - Unset/default → base patch only (rounded corners mask)
  - `liquid_glass_compositor` → base + overlay patch
- Meson options: `gtk_doc=true`, `tests=false`
- Compiler flags: `-O3 -fno-semantic-interposition`, linker: `-Wl,-Bsymbolic-functions`

## Package Output

- `gnome-shell-rounded-blur` — replaces system `gnome-shell` (`provides=('gnome-shell')`, `conflicts=('gnome-shell')`)
- `gnome-shell-rounded-blur-docs` — API documentation package
- Version: `1:50.0-1` (epoch 1)
