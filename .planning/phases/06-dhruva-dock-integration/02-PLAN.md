---
phase: 6
plan: 2
title: Dhruva Context Menu Blur Integration
wave: 2
requirements_addressed: []
estimated_tasks: 3
depends_on: [1]
---

# Plan 02 — Dhruva Context Menu Blur Integration

## Objective

Extend the Dhruva blur component to apply frosted glass blur behind Dhruva's custom context menus (right-click app menus, folder menus, Aero Peek menus).

## Context

Dhruva's context menus are **NOT** based on GNOME Shell's `BoxPointer`. They are fully custom:

```
context-menu-overlay (St.Widget, fullscreen, added via addChrome)
└── menuContainer (St.Widget, BinLayout)
    ├── bgDrawingArea (St.DrawingArea) — cairo-drawn background with arrow
    └── panel (St.BoxLayout) — menu items
```

Key challenges:
1. **Cairo-drawn background:** The shape includes a directional arrow — blur should cover the rectangular body only
2. **Ephemeral lifecycle:** Menus are created per-click, destroyed on close (150ms show delay)
3. **No BoxPointer:** Our existing boxpointer component won't catch these
4. **Position-dependent arrow:** Arrow direction matches dock position (BOTTOM/TOP/LEFT/RIGHT)

## Approach

### Context Menu Detection

Monitor `Main.layoutManager` for new chrome actors. When an actor with style class `context-menu-overlay` is added:
1. Find the `menuContainer` child
2. Find the `panel` child (the rectangular content area)
3. Wait for `panel` allocation to stabilize (connect `notify::allocation` once)
4. Create blur widget behind the panel region

### Blur Placement

The blur should cover the `panel` rectangle (not the full `menuContainer` which includes the arrow region). This means:
- Get `panel.get_transformed_position()` for stage coordinates
- Get `panel.get_preferred_size()` for dimensions
- Place blur as a sibling in the `menuContainer`, below `bgDrawingArea`
- Corner radius matches Dhruva's context menu radius (18px from CSS)

### Lifecycle

- **Show:** Inject blur after the 150ms show delay (use `notify::mapped` or `notify::visible` on menuContainer)
- **Hide:** The menu animates to `opacity: 0, scale: 0.95` then destroys. Connect `destroy` on overlay to clean up blur.
- **Fast re-open:** If user right-clicks another icon quickly, previous menu is force-destroyed via `_forceDestroy()`. Blur cleanup must handle this.

## Tasks

### Task 1: Chrome Monitor for Context Menus

Add chrome actor tracking to `DhruvaBlur.enable()`:
- Connect `Main.layoutManager` signals for tracking actors
- Filter for actors with `style_class` containing `context-menu-overlay`
- On detection, call `_blur_context_menu(overlay)`

**Files:** `components/dhruva.js`

### Task 2: Context Menu Blur Injection

Implement `_blur_context_menu(overlay)`:
- Walk children to find `menuContainer` → `panel`
- Wait for panel allocation via `notify::allocation` (one-shot)
- Create `DummyPipeline` blur widget
- Insert behind `bgDrawingArea` in `menuContainer`
- Size to panel dimensions, position to panel offset within menuContainer
- Connect `destroy` on overlay for cleanup

**Files:** `components/dhruva.js`

### Task 3: Animation Coordination

Ensure blur widget animates in sync with the context menu:
- Match the `ease()` animation: opacity 0→255, scale 0.95→1.0, 180ms EASE_OUT_QUAD
- On hide: match opacity 255→0, scale 1.0→0.95, 120ms EASE_IN_QUAD
- Set same `pivot_point` as `menuContainer`

**Files:** `components/dhruva.js`

## Verification

1. Right-click dock icon → context menu appears with blur behind it
2. Blur covers panel area only (not the arrow region)
3. Close menu → blur removes cleanly
4. Rapidly right-click different icons → no blur artifacts or leaks
5. Right-click with dock in different positions (BOTTOM/TOP/LEFT/RIGHT) → blur positions correctly
6. Disable blur-my-shell while menu is open → menu and blur clean up
