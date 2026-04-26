# Testing

> Mapped: 2026-04-26 (refreshed)

## Overview

blur-my-glass has **no automated tests** of its own. The project relies on:

1. Upstream GNOME Shell's test suite (inherited, disabled in build)
2. Manual visual verification after installation
3. Successful compilation as a basic smoke test
4. Grep-based verification of patch content (used during Phase 1+2)

## Upstream Test Infrastructure

GNOME Shell's test suite exists at `src/gnome-shell/tests/` and uses:

- **Framework:** jasmine-gjs (JavaScript BDD testing for GJS)
- **Runner:** `gnome-shell-dbus-runner.py` — launches a test environment with mocked DBus services
- **Test types:**
  - `tests/unit/` — Unit tests for JavaScript modules
  - `tests/shell/` — Integration tests with shell components
  - `tests/dbusmock-templates/` — Mock service definitions
- **Build integration:** Meson test targets, controlled by `-D tests=false` option

### Why tests are disabled
The `PKGBUILD` builds with `-D tests=false` because:
- Tests require a running Wayland session and dbus environment
- The build target is a production system package, not a development environment
- Test execution during `makepkg` would add significant build time and dependencies

## What Could Be Tested

### Shader Unit Tests (not implemented)
- SDF distance function accuracy for corner cases (zero radius, very large radius)
- Refraction UV warp output validation (boundary conditions)
- Anti-aliasing smoothstep transitions

### Patch Application Tests (not implemented)
- Verify base patch applies cleanly to current upstream tag
- Verify overlay applies cleanly on top of base
- Verify patched source compiles without warnings
- Verify GObject introspection exposes new properties

### Visual Regression Tests (not implemented)
- Screenshot comparison of blur with/without corner-radius
- Refraction distortion pattern validation

## Current Verification Process

| Step | Method | Automated? |
|------|--------|------------|
| Base patch applies | `patch -p1` in `prepare()` | Semi (build fails if not) |
| Overlay applies on base | `patch -p1` in `prepare()` | Semi (build fails if not) |
| Source compiles | `meson compile` in `build()` | Semi (build fails if not) |
| Package installs | `pacman -U` | Semi (install fails if not) |
| Blur renders correctly | Manual visual inspection | No |
| Corner radius works | Manual testing with blur-my-shell | No |
| Refraction visible | Manual testing (liquid glass only) | No |
| No regressions | Manual comparison with stock shell | No |
| Patch content correct | `grep` for expected GLSL/property code | Semi (used in Phase 2) |

## Coverage

- **C code coverage:** Not measured (no test harness for the patched code)
- **Shader coverage:** Not applicable (GLSL cannot be unit-tested in isolation without a GPU context)
- **Script coverage:** `install.sh` has no tests; error paths verified manually

## Mocking

No mocking infrastructure exists. Upstream GNOME Shell uses DBus mock templates at `tests/dbusmock-templates/` for service simulation.
