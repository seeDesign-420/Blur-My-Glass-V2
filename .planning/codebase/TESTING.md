# Testing

## Build Testing
- Local testing is done by building the package via `./install.sh` or `./install.sh --liquid-glass`.

## Runtime Testing
- Requires restarting the GNOME Shell session (logging out and back in, or rebooting).
- Integration testing is performed by using the patched compositor in conjunction with the `blur-my-shell` extension to verify that `corner-radius` and `refraction-strength` properties behave correctly.

## Automated Testing
- `tests=false` is explicitly set in the meson options within the `PKGBUILD`. Upstream tests are skipped to speed up the build process of the patched compositor.

*(Generated on 2026-04-29)*
