---
status: investigating
trigger: "Dhruva dock blur effect fails to dynamically track the dock's resize and magnification animations"
created: 2026-04-29T12:00:00+02:00
updated: 2026-04-29T16:30:00+02:00
---

# Debug: Dhruva Dock Blur

## Symptoms

- **Expected:** The frosted glass blur effect for the Dhruva dock should render behind the dock icons and dynamically track magnification.
- **Actual:** Blur is invisible. Earlier attempts showed: (a) blur above icons instead of behind, (b) blur blocking input, (c) blur widget missing allocation.
- **Timeline:** Present since Phase 6 Dhruva dock integration.
- **Reproduction:** Enable dhruva blur in blur-my-shell, hover over dock.

## Current Focus

- hypothesis: "blurWidget is added to Main.uiGroup and positioned using container.x + bgActor.x local coordinates with mirrored transforms. The blur is invisible — likely because the blur widget has zero size, is offscreen, or the NativeDynamicBlurEffect requires the widget to be in the same visual subtree as the blur target. Need to verify: (1) what position/size blurWidget actually gets, (2) whether the effect renders when parented to uiGroup."
- next_action: "Add diagnostic logging to sync_geometry to print blurWidget position/size/visibility to journal. Check if blurWidget is visible and has non-zero dimensions."

## Evidence

- timestamp: 2026-04-29T12:00:00+02:00
  event: "Created debug session based on prior conversation context"
- timestamp: 2026-04-29T14:36:00+02:00
  event: "GNOME Shell logs show 'Can't update stage views actor DhruvaContainer [ClutterActor] is on because it needs an allocation' — DhruvaContainer is raw Clutter.Actor, blurWidget (St.Widget) never gets allocations from parent"
- timestamp: 2026-04-29T14:40:00+02:00
  event: "Read Dhruva Magnifier.js lines 327-345: magnification uses bgActor.scale_x/scale_y/translation_x/translation_y transforms, NOT set_size/set_position"
- timestamp: 2026-04-29T14:45:00+02:00
  event: "Confirmed: bgActor pivot_point set by setupMagnification() per dock position (e.g. 0.5,1.0 for BOTTOM)"
- timestamp: 2026-04-29T15:40:00+02:00
  event: "Moved blurWidget to Main.uiGroup to solve allocation issue. Used get_transformed_position for positioning. Result: blur visible but ABOVE icons (wrong position) and blocking input (reactive St.Widget)."
- timestamp: 2026-04-29T16:11:00+02:00
  event: "Added reactive=false, switched to local coords (container.x + bgActor.x) with mirrored transforms. Result: blur is invisible. Sandbox cannot write to extension dir — file must be deployed via apply-dhruva-fix.sh."
- timestamp: 2026-04-29T16:26:00+02:00
  event: "File confirmed deployed to extension dir. GNOME Shell restarted. Blur still invisible."

## Eliminated

- hypothesis: "notify::allocation tracking would catch magnification changes"
  reason: "Magnifier.js never calls set_size/set_position on bgActor during hover. It only sets scale_x/scale_y/translation_x/translation_y."
- hypothesis: "blurWidget as child of DhruvaContainer (raw Clutter.Actor)"
  reason: "DhruvaContainer has no layout manager, so St.Widget children never receive allocation. Causes 'needs an allocation' error."
- hypothesis: "get_transformed_position gives correct position for uiGroup child"
  reason: "Blur appeared ABOVE icons, not behind them. get_transformed_position returns stage-global coords which don't match uiGroup-local space."

## Resolution

- root_cause: TBD
- fix: TBD
- verification: TBD
- files_changed:
  - `~/blur-my-glass-live/dhruva.js` (workspace source of truth)
  - deployed via `apply-dhruva-fix.sh` to `~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/components/dhruva.js`
