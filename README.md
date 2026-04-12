# 🔮 blur-my-glass

**Patched GNOME Shell** with rounded blur mask support for [blur-my-shell](https://github.com/aunetx/blur-my-shell) — enabling proper frosted glass effects with rounded corners on Wayland.

> Ships two patch variants: a stable **rounded corners mask** and an experimental **liquid glass compositor** effect.

## Why?

GNOME Shell's `ShellBlurEffect` doesn't support rounded corners natively — blur always renders as a sharp rectangle. This package replaces `gnome-shell` with a patched build that adds a `corner-radius` property to the blur effect, enabling extensions like blur-my-shell to apply rounded, frosted-glass blur regions.

The **liquid glass** variant goes further, adding refraction, specular highlights, and a full glass material pipeline at the compositor level.

## Quick Install

```bash
git clone https://github.com/seeDesign-420/blur-my-glass.git
cd blur-my-glass
./install.sh
```

> **Requires:** Arch Linux (or Arch-based distro) with GNOME 50.

## Patch Variants

| Patch | Flag | Description |
|-------|------|-------------|
| **Rounded corners mask** | *(default)* | Adds SDF-based `corner-radius` uniform to `ShellBlurEffect`. Stable, minimal change. |
| **Liquid glass compositor** | `--liquid-glass` | Full material pipeline: refraction, specular, ambient occlusion, frosted glass. Experimental. |

### Install with liquid glass:

```bash
./install.sh --liquid-glass
```

## Options

```
./install.sh [OPTIONS]

  --liquid-glass   Use the liquid glass compositor patch (experimental)
  --noconfirm      Skip pacman confirmation prompts
  --clean          Remove previous build artifacts before building
  -h, --help       Show this help
```

## Rebuilding After Updates

When GNOME Shell receives an update, you'll need to rebuild:

```bash
cd blur-my-glass
./install.sh --clean
```

To switch patch variants, just pass the flag:

```bash
./install.sh --clean --liquid-glass
```

## Uninstall

Revert to the stock GNOME Shell package:

```bash
sudo pacman -S gnome-shell
```

## How It Works

This is an Arch Linux `PKGBUILD` that:

1. Clones GNOME Shell 50.0 source from GNOME GitLab
2. Applies the selected patch to `src/shell-blur-effect.c` (and `.h`)
3. Builds with `meson` + `ninja` using Arch's optimized flags
4. Installs as `gnome-shell-rounded-blur`, which `provides` and `conflicts` with `gnome-shell`

The patch adds a `corner-radius` GObject property to `ShellBlurEffect`, with a GLSL signed-distance-field mask that clips blur output to a rounded rectangle.

## Credits

- Patch based on discussion in [blur-my-shell#594](https://github.com/aunetx/blur-my-shell/issues/594#issuecomment-3317236854)
- PKGBUILD based on Arch Linux `extra/gnome-shell`
- [blur-my-shell](https://github.com/aunetx/blur-my-shell) by [@aunetx](https://github.com/aunetx)

## License

GPL-3.0-or-later (same as GNOME Shell)
