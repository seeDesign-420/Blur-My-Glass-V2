# Requirements — v1.0 Anti-Aliased Unified Patches

## SDF Quality

- [ ] **SDF-01**: Rounded corners mask uses correct box SDF with interior term (`min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - radius`)
- [ ] **SDF-02**: Mask edges are anti-aliased using `smoothstep()` with screen-space derivative width via `fwidth()`
- [ ] **SDF-03**: Anti-aliasing width has a minimum floor to prevent pixel-thin artifacts on large surfaces

## Patch Architecture

- [ ] **PATCH-01**: A base patch exists containing only the shared mask infrastructure (SDF mask, `corner-radius` property, `mask_fb` FBO pass)
- [ ] **PATCH-02**: A liquid glass overlay patch exists that applies on top of the base patch, adding refraction, specular, and lighting
- [ ] **PATCH-03**: Both patch variants build successfully against GNOME Shell 50.0
- [ ] **PATCH-04**: Base patch preserves upstream GNOME Shell code style (no reformatting of unchanged lines)

## Verification

- [ ] **VFY-01**: Rounded corners render with smooth, alias-free edges at all tested corner radii (0, 12, 24, 48 px)
- [ ] **VFY-02**: Liquid glass variant renders identically to current behavior (no regression)
- [ ] **VFY-03**: `install.sh` works with both `--liquid-glass` and default modes using the new stacked patches

## Future Requirements

- GLSL uniform for per-corner radius control (different radius per corner)
- Runtime patch variant switching without rebuild

## Out of Scope

- Refraction shader changes (liquid glass rendering logic stays as-is)
- Multi-distro packaging (remains Arch-only)
- Upstream GNOME contribution

## Traceability

| REQ | Phase | Status |
|-----|-------|--------|
| SDF-01 | 1 | Pending |
| SDF-02 | 1 | Pending |
| SDF-03 | 1 | Pending |
| PATCH-01 | 2 | Pending |
| PATCH-02 | 2 | Pending |
| PATCH-03 | 2 | Pending |
| PATCH-04 | 2 | Pending |
| VFY-01 | 3 | Pending |
| VFY-02 | 3 | Pending |
| VFY-03 | 3 | Pending |
