# Manual Runtime Checklist (GNOME Session)

This checklist closes the remaining runtime-only acceptance criteria from `refactor-plan.md`.

## Setup

1. Restart GNOME Shell session or log out/in.
2. Open a terminal and run:

```bash
journalctl --user -f /usr/bin/gnome-shell
```

3. Keep extension logs visible while testing.

## Basic Lifecycle

1. Enable Blur My Glass.
2. Disable Blur My Glass.
3. Re-enable Blur My Glass.
4. Confirm no warnings/errors in shell log.
5. Confirm no stuck blur actors remain visible after disable.

## Settings Stress

1. Open preferences.
2. Toggle overlays blur on/off repeatedly.
3. Change sigma, brightness, corner radius, vibrancy, refraction.
4. While changing values, rapidly open/close menus.
5. Confirm no crash and no stale blur surfaces.

## Overlay Coverage

Verify blur behavior for:

- quick settings
- date menu/calendar
- notifications
- OSD
- app menu
- desktop right-click menu
- popup submenus

## Animation Quality

During rapid open/close:

- no early blur disappearance
- no geometry lag
- no close-animation flicker
- no stutter from repeated geometry sync

## Dhruva Integration

If Dhruva is installed:

1. Confirm dock blur attaches and tracks geometry.
2. Confirm context menu blur attaches and tracks geometry.
3. Test dock auto-hide and magnification/animation.
4. Disable Blur My Glass and confirm all Dhruva blur actors are removed.

## Multi-monitor

1. Open overlays on each monitor.
2. Move windows between monitors.
3. Re-test dock/menu overlays on secondary monitor.
4. Confirm geometry alignment and clipping remain correct.

## Pass/Fail Log Template

Record results in `docs/refactor-completion-audit.md` under a new section:

- date/time
- GNOME version
- pass/fail per checklist section
- observed warnings/errors (if any)
