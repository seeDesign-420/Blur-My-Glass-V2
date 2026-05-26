# Blur My Glass Backend Runtime Architecture

## Scope

This document describes the GJS runtime architecture used by Blur My Glass after the backend refactor.

It focuses on:

- lifecycle safety
- overlay/dhruva blur ownership
- settings routing
- geometry synchronization
- compatibility boundaries

## Rust Decision

The GNOME Shell runtime backend remains in GJS.

The following are intentionally kept in GJS:

- Clutter/St actor discovery
- actor signal connection/disconnection
- popup/menu lifecycle hooks
- Shell.BlurEffect property mutation
- background group insertion/removal
- GSettings live handling
- component enable/disable lifecycle

Rust may be used later for tooling and diagnostics, but not as a runtime dependency in the GNOME Shell process.

## Runtime Modules

### Core lifecycle/runtime

- `extension/src/runtime/disposable_store.js`
  - shared ownership for signals, sources, actors, pipelines, cleanup callbacks
  - idempotent disposal
- `extension/src/runtime/blur_geometry_tracker.js`
  - coalesces geometry updates to one sync per frame
- `extension/src/runtime/component_registry.js`
  - component registration, enable/disable, rebuild ordering
- `extension/src/runtime/settings_router.js`
  - centralized settings change routing
- `extension/src/runtime/session_mode_controller.js`
  - session-mode transitions and component state updates
- `extension/src/runtime/capability_service.js`
  - runtime capability checks (for example rounded blur support)

### Blur pipeline

- `extension/src/blur/dynamic_blur_pipeline.js`
  - dynamic blur pipeline implementation
- `extension/src/blur/blur_background_surface.js`
  - background actor/group ownership
- `extension/src/blur/blur_effect_binding.js`
  - settings-to-effect property synchronization
- `extension/src/conveniences/dummy_pipeline.js`
  - compatibility export (`DummyPipeline` alias of `DynamicBlurPipeline`)

### Overlays subsystem

- `extension/src/components/overlays.js`
  - thin lifecycle entry point
- `extension/src/overlays/overlay_surface_controller.js`
  - generic surface ownership and geometry sync
- `extension/src/overlays/popup_overlay_controller.js`
  - popup-specific open/close behavior
- `extension/src/overlays/popup_hook_manager.js`
  - popup prototype hooks + dynamic popup tracking
- `extension/src/overlays/quick_settings_control_layer.js`
  - quick settings control-layer orchestration
- `extension/src/overlays/quick_settings_control_surface.js`
  - per-control quick settings blur surfaces
- `extension/src/overlays/overlay_surface_registry.js`
  - target discovery and controller registry
- `extension/src/overlays/constants.js`
- `extension/src/overlays/geometry.js`
- `extension/src/overlays/actor_utils.js`

### Dhruva integration

- `extension/src/components/dhruva.js`
  - thin orchestrator
- `extension/src/integrations/dhruva_target_resolver.js`
  - actor/target discovery heuristics
- `extension/src/integrations/dhruva_dock_surface_controller.js`
  - dock blur surface control
- `extension/src/integrations/dhruva_context_menu_surface_controller.js`
  - context menu blur surface control

## Lifecycle Invariants

- Every connected signal must have a tracked cleanup path.
- Every GLib source id must be tracked and removed.
- Every injected actor/surface must be destroyed or detached on disable.
- Settings callbacks must tolerate missing/destroyed actors/effects.
- Geometry syncing should be queued and coalesced rather than executed per signal.

## Validation Tooling

- `scripts/check-schema-keys.js`
- `scripts/check-untracked-connects.sh`
- `scripts/lint-gjs.sh`
- `scripts/validate-patches.sh`

`validate-patches.sh` validates the compositor patch stack in a temporary clean detached worktree so in-progress local shell edits do not produce false failures.
