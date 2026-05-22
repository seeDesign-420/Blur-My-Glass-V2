# blur-my-glass

`blur-my-glass` bundles two pieces: a patched GNOME Shell package and a vendored blur-my-shell fork with Dhruva integration.

## Install

```bash
./install.sh
```

That installs both layers on Arch Linux. Use `--shell-only` or `--extension-only` to install one side only, `--liquid-glass` for the experimental compositor path, and `--clean` to remove build output first.

## Layout

- `PKGBUILD` builds the patched shell package.
- `extension/` contains the extension fork that is installed by `make -C extension install`.
- `install.sh` is the top-level entrypoint for the combined product.

## Notes

- The shell patch still targets GNOME 50.
- The extension keeps the upstream schema id for compatibility.
- Legacy Dhruva deploy helpers were removed in favor of the unified installer.
