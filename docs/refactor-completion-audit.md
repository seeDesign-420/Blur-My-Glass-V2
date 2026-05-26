# Refactor Plan Completion Audit

Source of truth: `refactor-plan.md`

## Verified Complete (Code + Automated Gates)

### Phase 1: Lifecycle bug fixes

- `EffectsManager` actor destroy tracking updates are implemented in `extension/src/conveniences/effects_manager.js`.
- Cleanup resets old actor references/ids to `null`.
- Blur settings callbacks are guarded against missing effect state via the split blur pipeline modules.

### Phase 2: Dummy pipeline rename/split

- Real pipeline implementation exists as `DynamicBlurPipeline` in `extension/src/blur/dynamic_blur_pipeline.js`.
- Compatibility alias preserved in `extension/src/conveniences/dummy_pipeline.js`:
  - `export const DummyPipeline = DynamicBlurPipeline`.
- Split responsibilities exist:
  - `blur_background_surface.js`
  - `blur_effect_binding.js`
  - `dynamic_blur_pipeline.js`

### Phase 3: Disposable lifecycle ownership

- Shared utility: `extension/src/runtime/disposable_store.js`.
- Applied to Dhruva components/controllers and overlay subsystem controllers/layers.
- Overlay controllers now use `DisposableStore` for lifecycle signals (no manual signal-id arrays in overlay controllers).

### Phase 4: Coalesced geometry sync

- Shared tracker: `extension/src/runtime/blur_geometry_tracker.js`.
- Uses `Meta.later_add(...BEFORE_REDRAW)` with tracked fallback source.
- Integrated into overlays and Dhruva controllers.

### Phase 5: overlays split

- Split files present:
  - `constants.js`
  - `actor_utils.js`
  - `geometry.js`
  - `overlay_surface_controller.js`
  - `popup_overlay_controller.js`
  - `popup_hook_manager.js`
  - `quick_settings_control_surface.js`
  - `quick_settings_control_layer.js`
  - `overlay_surface_registry.js`
  - `components/overlays.js` (thin entry point)

### Phase 6: Dhruva shared surface model

- Split integration modules present:
  - `dhruva_target_resolver.js`
  - `dhruva_dock_surface_controller.js`
  - `dhruva_context_menu_surface_controller.js`
  - `components/dhruva.js` thin orchestrator
- Uses shared lifecycle + geometry helpers (`DisposableStore`, `BlurGeometryTracker`).

### Phase 7: extension.js thinning

- Runtime modules introduced:
  - `component_registry.js`
  - `settings_router.js`
  - `session_mode_controller.js`
  - `capability_service.js`
- `extension.js` is orchestrated through these helpers.

### Phase 8: validation tooling

- Scripts present:
  - `scripts/check-schema-keys.js`
  - `scripts/lint-gjs.sh`
  - `scripts/check-untracked-connects.sh`
  - `scripts/validate-patches.sh`
- `validate-patches.sh` validates patches in a clean detached GNOME Shell worktree and validates patch stack ordering (`base` then `overlay`).

## Automated Verification Snapshot

- `./scripts/check-schema-keys.js`: pass
- `./scripts/check-untracked-connects.sh`: pass
- `./scripts/lint-gjs.sh`: pass
- `./scripts/validate-patches.sh src/gnome-shell`: pass

## Documentation Deliverables

- Backend architecture + Rust decision document:
  - `docs/backend-runtime-architecture.md`

## Remaining Items (Manual Runtime Verification Required)

The following acceptance criteria require a live GNOME Shell runtime session and are not proven by static checks:

- enable/disable cycle leaves no residual blur actors
- no leaked runtime signals/sources after disable
- overlays behavior parity (quick settings, date menu, notifications, OSD, app/desktop/panel menus)
- Dhruva dock/context-menu behavior under animation/auto-hide
- animation smoothness/flicker checks
- multi-monitor geometry correctness

Until those manual checks are executed and recorded, full completion of `refactor-plan.md` cannot be claimed as proven.
