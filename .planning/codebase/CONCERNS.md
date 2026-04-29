# Areas of Concern

## Maintainability
- **Upstream Drift:** The patches directly modify `shell-blur-effect.c` and `.h`. Any significant refactoring of the blur effect in upstream Mutter/GNOME Shell will require rebasing the patches.
- **Stacked Patches:** `liquid_glass_compositor.patch` is designed to be applied *after* `rounded_corners_mask.patch`. Changes to the base patch must be carefully managed to avoid breaking the overlay patch.

## Technical Debt
- **GLSL in C Strings:** Developing and debugging complex shaders (like the liquid glass refraction) as C string literals is error-prone.
- **Distribution:** Currently limited to Arch Linux due to reliance on `PKGBUILD` and `makepkg`.

## Performance
- The `liquid_glass_compositor.patch` relies on evaluating screen-space derivatives (`dFdx`, `dFdy`) and complex SDF logic per fragment, which could impact rendering performance on lower-end hardware.

*(Generated on 2026-04-29)*
