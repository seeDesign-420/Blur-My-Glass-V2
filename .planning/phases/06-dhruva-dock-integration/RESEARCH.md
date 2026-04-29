# Phase 6 Research — Dhruva Dock Integration

> Researched: 2026-04-29

## Dhruva Architecture Overview

Dhruva is a modular GNOME Shell dock extension (~99% JavaScript). It creates its own Clutter actor hierarchy entirely outside the standard GNOME Shell panel and popup system.

### Actor Hierarchy

```
DhruvaContainer (Clutter.Actor, name='DhruvaContainer')
├── DhruvaBackground (St.Widget, name='DhruvaBackground', style_class='plank-like-dock-bg')
│   └── Styled via DockThemes + _applyDynamicStyles()
└── Dhruva (St.BoxLayout, name='Dhruva', style_class='plank-like-dock')
    ├── dock-app-button children (icons)
    ├── dock-separator children
    ├── dock-drag-handle
    ├── clock-module (optional)
    └── _isExternal children (Music Pill etc.)
```

**Key actors for blur integration:**

| Actor | Variable | Type | What it is |
|-------|----------|------|------------|
| `this.actor` | `DhruvaContainer` | `Clutter.Actor` | Root container, added to `Main.layoutManager.addChrome()` |
| `this.bgActor` | `DhruvaBackground` | `St.Widget` | The background panel — **PRIMARY BLUR TARGET** |
| `this.boxActor` | `Dhruva` | `St.BoxLayout` | Icon container, sits on top of background |

### Dock Background Rendering

The background is an `St.Widget` styled via CSS properties:
- `background-color` / `background-gradient-*` set by `applyDockTheme()` in `Themes.js`
- `border-radius` from settings (`border-radius` key)
- `stroke-width` / `stroke-color` from settings
- Positioned and sized by `_updateLayout()` → `this.bgActor.set_position(bgX, bgY)` / `this.bgActor.set_size(bgW, bgH)`

The background position changes dynamically with:
- Dock position (TOP/BOTTOM/LEFT/RIGHT)
- Full-width mode vs floating mode
- Monitor changes
- Magnification zoom

### Context Menu Architecture

Dhruva's `AppContextMenu` is **NOT** based on GNOME's `BoxPointer`. It's a fully custom implementation:

```
context-menu-overlay (St.Widget, full screen overlay)
└── menuContainer (St.Widget, BinLayout)
    ├── bgDrawingArea (St.DrawingArea) — custom cairo-drawn background with arrow
    └── panel (St.BoxLayout, vertical) — menu items
```

**Key differences from BoxPointer:**
1. Uses `St.DrawingArea` with cairo for the background shape (including directional arrow)
2. Added to chrome via `Main.layoutManager.addChrome(this.actor)`
3. Custom show/hide animations (scale+opacity, not BoxPointer transitions)
4. Position calculated relative to the clicked button actor
5. Arrow center tracked via `bgDrawingArea._arrowCenter`

### Discovery System Requirements

**Finding dock instances at runtime:**
- `DhruvaExtension` stores all docks in `this._docks[]` array
- Each dock is a `DockUI` instance with `.actor`, `.bgActor`, `.boxActor`
- Docks are destroyed and recreated on monitor changes (`_reloadDocks()`)

**Finding context menus at runtime:**
- `DockUI._activeContextMenu` holds the current menu
- Context menus are ephemeral — created per-click, destroyed on close
- They're not children of the dock actor; they're separate chrome actors

## Integration Strategy Analysis

### Option A: Extension-to-Extension Communication (Rejected)

Direct import or D-Bus between blur-my-glass and Dhruva. **Rejected** because:
- Creates a hard dependency
- Requires Dhruva to expose internals
- Complex lifecycle coordination

### Option B: Actor Discovery via Chrome Walking (Selected)

Walk `Main.layoutManager._trackingActors` or `global.stage` to find actors named `DhruvaBackground` / `DhruvaContainer`. This is the same pattern used by blur-my-shell for its existing components.

**Advantages:**
- No Dhruva code changes needed
- Works with any Dhruva version that uses these actor names
- Follows blur-my-shell's established component pattern

### Option C: Signal-Based Hook (Hybrid — for context menus)

For context menus, we can't easily discover them via the stage because they're ephemeral. Instead:
- Monitor `Main.layoutManager` chrome add/remove signals
- Check if added actor has style class `context-menu-overlay`
- Apply blur to the `bgDrawingArea`'s region

## Blur Application Points

### 1. Dock Background (`bgActor`)

- **Actor:** `St.Widget` named `DhruvaBackground`
- **Blur region:** Matches `bgActor` allocation exactly
- **Corner radius:** Read from Dhruva's `border-radius` setting or blur-my-shell's own setting
- **Lifecycle:** Track via `notify::mapped` / `notify::visible` / `destroy`
- **Dynamic updates:** Must re-track on `_reloadDocks()` (monitors-changed signal)
- **Challenge:** `bgActor` position is relative to its parent (`DhruvaContainer`), not stage coordinates. Need `get_transformed_position()` for blur placement.

### 2. Context Menu Background

- **Actor:** `St.DrawingArea` (cairo-drawn, NOT St.Widget CSS)
- **Challenge:** The cairo-drawn shape includes an arrow pointer — blur should cover only the rectangular body
- **Approach:** Create blur widget sized to `menuContainer` minus arrow height, positioned to match the panel region
- **Lifecycle:** Ephemeral — created on right-click, destroyed on close
- **Timing:** Must inject after `show()` delay (150ms `GLib.timeout_add`)

## Compatibility Concerns

1. **Actor naming stability:** Dhruva uses `name: 'DhruvaContainer'`, `name: 'DhruvaBackground'`, `name: 'Dhruva'` — these are stable identifiers
2. **Extension load order:** blur-my-glass may enable before or after Dhruva. Must handle both cases.
3. **Dock destruction:** Dhruva destroys and recreates docks on monitor changes. Blur must survive this cycle.
4. **Floating mode:** Dock can be freely positioned via drag handles. Blur position must track via `notify::allocation`
5. **Scale transforms:** `_updateLayout()` applies `set_scale()` on the container — blur must account for this
6. **Theme changes:** Background CSS changes on theme switch — blur should remain regardless

## Component Design

The new component should follow the existing `boxpointer.js` pattern:

```javascript
export const DhruvaBlur = class DhruvaBlur {
    constructor(connections, settings, effects_manager) { ... }
    enable() { ... }   // Start tracking, apply blur
    disable() { ... }  // Remove all blur, disconnect signals
}
```

Registered in `extension.js` `enable()`/`disable()` alongside existing components.
