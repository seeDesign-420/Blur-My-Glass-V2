---
phase: 6
plan: 1
title: Dhruva Dock Background Blur Component
wave: 1
requirements_addressed: []
estimated_tasks: 5
---

# Plan 01 — Dhruva Dock Background Blur Component

## Objective

Create a new blur-my-shell component (`components/dhruva.js`) that discovers Dhruva dock instances at runtime and applies frosted glass blur behind the dock background panel (`DhruvaBackground` actor).

## Context

Dhruva creates its dock as `DhruvaContainer → DhruvaBackground + Dhruva(BoxLayout)`. The background is an `St.Widget` styled via CSS. Unlike GNOME Shell panels which are always present, Dhruva docks are:
1. Created dynamically (multiple docks for multi-monitor)
2. Destroyed and recreated on monitor changes
3. Subject to scale transforms from `_updateLayout()`
4. Optionally in floating mode with drag positioning

The blur must be injected as a **sibling behind `bgActor`** within the `DhruvaContainer`, tracking its position and size via allocation signals.

## Approach

### Actor Discovery

Walk `global.stage.get_children()` → check each chrome actor for `name === 'DhruvaContainer'`. Store references. Re-scan on:
- `Main.layoutManager` chrome signals (actor added/removed)  
- Extension enable (delayed scan via idle callback)

### Blur Injection

For each discovered `DhruvaContainer`:
1. Find child with `name === 'DhruvaBackground'` → `bgActor`
2. Create a `DummyPipeline` blur widget (same as boxpointer component)
3. Insert blur widget into `DhruvaContainer` below `bgActor` via `insert_child_below(blur, bgActor)`
4. Size/position blur to match `bgActor` allocation
5. Connect `notify::allocation` on `bgActor` to track geometry changes
6. Connect `notify::visible` / `notify::mapped` / `destroy` for lifecycle

### Settings Schema

Add to `schemas/org.gnome.shell.extensions.blur-my-shell.gschema.xml`:
```xml
<schema id="org.gnome.shell.extensions.blur-my-shell.dhruva" path="/org/gnome/shell/extensions/blur-my-shell/dhruva/">
  <key name="blur" type="b"><default>false</default></key>
  <key name="pipeline" type="s"><default>'pipeline_default'</default></key>
  <key name="sigma" type="i"><default>30</default><range min="0" max="111"/></key>
  <key name="brightness" type="d"><default>0.6</default><range min="0.0" max="1.0"/></key>
  <key name="corner-radius" type="i"><default>24</default><range min="0" max="99"/></key>
  <key name="refraction-strength" type="d"><default>0.0</default><range min="0.0" max="1.0"/></key>
</schema>
```

## Tasks

### Task 1: Create GSettings Schema

Add the `dhruva` sub-schema with blur toggle, pipeline, sigma, brightness, corner-radius, and refraction-strength keys. Update `conveniences/keys.js` with the new component key paths.

**Files:** `schemas/org.gnome.shell.extensions.blur-my-shell.gschema.xml`, `conveniences/keys.js`

### Task 2: Create Dhruva Blur Component

Create `components/dhruva.js` implementing the `DhruvaBlur` class:
- `enable()`: Start scanning for Dhruva actors, connect chrome signals
- `disable()`: Remove all blur widgets, disconnect all signals
- `_scan_for_docks()`: Walk chrome actors for `DhruvaContainer`
- `_blur_dock(container)`: Inject DummyPipeline blur behind bgActor
- `_unblur_dock(container)`: Remove blur, disconnect signals
- `_update_blur_geometry(blur, bgActor)`: Sync size/position from allocation

Pattern follows `boxpointer.js` closely.

**Files:** `components/dhruva.js`

### Task 3: Register Component in Extension

Register the new `DhruvaBlur` component in `extension.js` `enable()`/`disable()` alongside existing components (`appfolders`, `boxpointer`).

**Files:** `extension.js`

### Task 4: Create Preferences Page

Create `preferences/dhruva.js` and `ui/dhruva.ui` for the Dhruva dock blur settings. Add a new "Dhruva Dock" page to the preferences window.

**Files:** `preferences/dhruva.js`, `ui/dhruva.ui`, `prefs.js`

### Task 5: Multi-Monitor & Reload Resilience

Handle edge cases:
- Dock destruction during `_reloadDocks()` — re-scan after idle
- Multiple docks (show-on-all-monitors) — blur each independently
- Extension enable order — delayed discovery if Dhruva enables after blur-my-shell
- Scale transforms — read `get_scale()` from container and adjust blur accordingly

Add a periodic re-scan fallback (every 2s for 10s after enable) to handle extension load order races.

**Files:** `components/dhruva.js`

## Verification

1. Enable Dhruva + blur-my-shell → dock background shows frosted glass
2. Change Dhruva dock position (BOTTOM→LEFT) → blur follows
3. Enable multi-monitor → blur appears on all dock instances
4. Disable blur-my-shell → blur removes cleanly, no errors
5. Re-enable blur-my-shell → blur reappears
6. Change Dhruva theme → blur persists through theme change
7. Toggle floating mode → blur tracks drag position
