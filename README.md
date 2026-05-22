# blur-my-glass

`blur-my-glass` is a clean packaging repo for two shipped pieces:
- a patched GNOME Shell package for rounded blur and liquid-glass builds
- a vendored blur-my-shell fork with Dhruva integration

## Quick Start

```bash
git clone https://github.com/seeDesign-420/Blur-My-Glass-V2.git
cd Blur-My-Glass-V2
./install.sh
```

Use `--liquid-glass` for the experimental compositor path, `--shell-only` or `--extension-only` to install one side only, and `--clean` to remove build output first.

## What Is In The Repo

- `install.sh` is the single entrypoint for both layers.
- `PKGBUILD` builds the patched shell package on Arch Linux.
- `extension/` contains the bundled extension source and metadata.
- `patches/` contains the shell patch set used by `PKGBUILD` and `install.sh`.

## Compatibility

- The shell package targets GNOME 50.
- The extension keeps the upstream schema id for compatibility with existing settings.
- This repo is intended for Arch Linux or an Arch-based distro.
