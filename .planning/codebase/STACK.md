# Technology Stack

*Mapped: 2026-05-03*

## Languages

| Language | Role | Files |
|----------|------|-------|
| **C** | Compositor patches to `shell-blur-effect.c/.h` | `patches/*.patch` |
| **GLSL** | SDF shader code embedded in C string literals | inline in patches |
| **JavaScript (GJS)** | GNOME Shell extension component (`dhruva.js`) | `dhruva.js` |
| **Bash** | Build orchestration, deployment scripts | `install.sh`, `deploy-dhruva.sh`, `apply-dhruva-fix.sh` |
| **PKGBUILD** | Arch Linux package definition (Bash dialect) | `PKGBUILD` |

## Runtime Environment

- **GNOME Shell 50.0** — Mutter 18 API (`libmutter-18.so`)
- **GJS** — GNOME JavaScript runtime (ES modules with GI bindings)
- **Wayland** — primary display protocol (X11 supported via `libx11`, `libxext`, `libxfixes`)
- **Clutter** — Mutter's scene graph / actor framework
- **St (Shell Toolkit)** — GNOME Shell's widget layer over Clutter
- **Cogl** — GPU pipeline / shader injection layer used by `ShellBlurEffect`

## Key Dependencies (from PKGBUILD)

### Runtime (`depends`)

| Category | Packages |
|----------|----------|
| Core compositor | `mutter`, `gjs`, `glib2`, `cairo`, `graphene`, `libglvnd` |
| Desktop integration | `gnome-session`, `gnome-settings-daemon`, `gnome-desktop-4`, `gsettings-desktop-schemas` |
| UI toolkit | `gtk4`, `libadwaita`, `pango`, `gdk-pixbuf2`, `hicolor-icon-theme` |
| Input | `ibus`, `libibus`, `at-spi2-core` |
| Audio / media | `libpipewire`, `libpulse`, `libcanberra-pulse` |
| Networking | `libsoup3`, `libnm`, `libnma-gtk4`, `webkitgtk-6.0` |
| Authentication | `gcr-4`, `libgdm`, `polkit`, `libsecret` |
| System | `accountsservice`, `dconf`, `json-glib`, `upower`, `systemd-libs`, `bash`, `glibc`, `libgcc`, `unzip` |
| Calendar / weather | `libical`, `libgweather-4` |

### Build-time (`makedepends`)

| Package | Purpose |
|---------|---------|
| `meson` | Build system |
| `git` | Source checkout |
| `sassc` | SCSS → CSS compilation |
| `gobject-introspection` | GI typelib generation |
| `gi-docgen` | API documentation |
| `glib2-devel` | GLib development headers |
| `gnome-keybindings` | Keybinding schema data |
| `python-docutils` | Man page generation |
| `asciidoc`, `bash-completion` | Documentation / shell completion |

### Extension dependency (blur-my-shell)

The `dhruva.js` component imports from `blur-my-shell@aunetx`:

| Module | Import |
|--------|--------|
| `conveniences/dummy_pipeline.js` | `DummyPipeline` — wraps `EffectsManager.new_native_dynamic_gaussian_blur_effect()` |
| `conveniences/connections.js` | `Connections` — signal management |
| `conveniences/settings.js` | `Settings` — GSettings wrapper with `KEYS` |
| `conveniences/keys.js` | `KEYS` — component settings keys |
| `conveniences/effects_manager.js` | `EffectsManager` — GPU effect pool (prevents RAM bleeding) |

## Build System

| Tool | Usage |
|------|-------|
| **makepkg** | Arch Linux package builder (`PKGBUILD` → `.pkg.tar.zst`) |
| **Meson + Ninja** | GNOME Shell compilation (`arch-meson gnome-shell build`) |
| **patch (GNU)** | Applies `patches/*.patch` to upstream GNOME Shell source at `prepare()` |

### Stacked Patch Architecture

```
PKGBUILD prepare()
  ├── Always: patch -p1 -i rounded_corners_mask.patch    (base)
  └── If BLUR_PATCH=liquid_glass_compositor:
              patch -p1 -i liquid_glass_compositor.patch  (overlay)
```

## Configuration

| Type | Location | Purpose |
|------|----------|---------|
| `PKGBUILD` | Root | Package metadata, source URLs, b2sums, build instructions |
| GSettings schema | `blur-my-shell@aunetx/schemas/` | Extension preferences (dhruva component settings: sigma, brightness, corner-radius) |
| Mutter overrides | Embedded in `package_*()` | `30_org.archlinux.gnome-shell-rounded-blur.gschema.override` — enables VRR, fractional scaling |

## Compiler Flags

```bash
CFLAGS="${CFLAGS/-O2/-O3} -fno-semantic-interposition"
LDFLAGS+=" -Wl,-Bsymbolic-functions"
```

Aggressive optimization (`-O3`) with semantic interposition disabled for better inlining. Symbolic functions binding for reduced PLT overhead.
