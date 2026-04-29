# Coding Conventions

## Patch Structure
- Patches are kept as minimal as possible to reduce conflicts with upstream GNOME Shell updates.
- GLSL shader code is embedded as string literals within the C code.
- Uniforms and shared globals in GLSL are prefixed with `r_` (e.g., `r_transition`, `r_border`) to avoid namespace collisions in `liquid_glass_compositor.patch`.

## Build Script Style
- `install.sh` uses strict bash mode (`set -euo pipefail`).
- Colorful console output for logging (`info()`, `ok()`, `warn()`, `err()`, `die()`).

*(Generated on 2026-04-29)*
