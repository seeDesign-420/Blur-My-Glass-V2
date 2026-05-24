# Requirements - v1.2 Broad Shell Overlay Glass

## Overlay Coverage

- [ ] **OVR-01**: Date/calendar menu renders blur/glass background that tracks menu geometry and animation without clipping artifacts.
- [ ] **OVR-02**: Quick Settings menu renders blur/glass background with correct placement and rounded edge behavior.
- [ ] **OVR-03**: Notification banners and notification list render blur/glass background without interfering with message tray behavior.
- [ ] **OVR-04**: OSD overlays render blur/glass treatment with clean lifecycle and no stuck actors.
- [ ] **OVR-05**: Desktop context menus render blur/glass treatment where actor structure allows safe injection.
- [ ] **OVR-06**: Application and jump-list menus render blur/glass treatment where technically feasible.

## Lifecycle and Stability

- [ ] **LIFE-01**: Overlay blur actors are attached and detached cleanly on open/close and session mode transitions.
- [ ] **LIFE-02**: No actor leaks, orphaned effects, or recurring signal handlers after repeated menu open/close cycles.
- [ ] **LIFE-03**: Overlay implementation tolerates GNOME Shell actor-tree timing/reparenting without crashes.

## Configuration and UX

- [ ] **CFG-01**: Overlay blur behavior is configurable through extension settings using existing component conventions where possible.
- [ ] **CFG-02**: Default settings preserve readability and avoid obvious visual regressions on light and dark backgrounds.
- [ ] **CFG-03**: Existing blur components (panel, dash, applications, dhruva, lockscreen, etc.) continue to work unchanged.

## Future Requirements

- Brightness/vibrancy tuning with stronger perceived glass effect while preserving text clarity.
- Additional per-overlay customization depth if required after baseline v1.2 coverage ships.
- Potential deeper adoption of `liquid-glass` adaptive text/tint techniques after baseline stabilization.

## Out of Scope

- Full replacement of the current architecture with a pure `Clutter.ShaderEffect` clone-based stack in v1.2.
- New compositor C patch architecture changes beyond what is needed to keep overlay rendering stable.
- Multi-distro packaging.
- Runtime patch variant switching without rebuild.

## Traceability

| REQ | Phase | Status |
|-----|-------|--------|
| OVR-01 | 8 | Pending |
| OVR-02 | 8 | Pending |
| OVR-03 | 8 | Pending |
| OVR-04 | 8 | Pending |
| OVR-05 | 8 | Pending |
| OVR-06 | 8 | Pending |
| LIFE-01 | 8 | Pending |
| LIFE-02 | 8 | Pending |
| LIFE-03 | 8 | Pending |
| CFG-01 | 8 | Pending |
| CFG-02 | 8 | Pending |
| CFG-03 | 8 | Pending |
