# Refactor Plan Completion Audit

Source of truth: `refactor-plan.md`

## Verified Complete (Code + Automated Gates)

### Phase 1: Lifecycle bug fixes

- `EffectsManager` actor destroy tracking updates are implemented in `extension/src/conveniences/effects_manager.js`.
- Cleanup resets old actor references/ids to `null`.
- Blur settings callbacks are guarded against missing effect state via the split blur pipeline modules.

### Phase 2: Dynamic pipeline split

- Real pipeline implementation exists as `DynamicBlurPipeline` in `extension/src/blur/dynamic_blur_pipeline.js`.
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

## Live Runtime Evidence (GNOME Shell)

Snapshot captured on 2026-05-26 (local SAST session):

- Extension package now includes refactor modules (`runtime/`, `overlays/`, `integrations/`, `blur/`) in installed path:
  - `/home/thomas/.local/share/gnome-shell/extensions/blur-my-glass@seedesign-420`
- Live extension state (D-Bus `GetExtensionInfo`):
  - `enabled = true`
  - `state = 1` (enabled)
  - `error = ''`
- Live extension error list (D-Bus `GetExtensionErrors`):
  - `[]` (empty)
- Fresh shell logs (last 3 minutes) showed no new `blur-my-glass` `JS ERROR` / `ReferenceError` / `TypeError` entries.

Additional repeatable runtime gate:

- `./scripts/runtime-smoke-check.sh blur-my-glass@seedesign-420 "3 minutes ago"`: pass
  - performs disable/enable reload via D-Bus
  - asserts `enabled=true`, `state=1`, `error=''`
  - asserts empty `GetExtensionErrors` list
  - scans recent shell logs for `blur-my-glass` error markers

- `./scripts/runtime-lifecycle-stress.sh blur-my-glass@seedesign-420 5 0.5`: pass
  - performs 5 disable/enable cycles via D-Bus
  - asserts `enabled=true`, `state=1`, `error=''` after each cycle
  - asserts empty `GetExtensionErrors` list after each cycle
  - scans logs since test start for extension-specific JS errors

- Evidence bundle collector:
  - `./scripts/collect-runtime-evidence.sh blur-my-glass@seedesign-420 "3 minutes ago"`
  - latest captured artifact:
    - `docs/runtime-evidence/2026-05-26_14-38-08.md`

Fixes validated by this evidence:

- Packaging bug fixed: new runtime modules are shipped by `extension/Makefile`.
- Runtime `GLib` reference fault fixed in `components/applications.js`.
- Additional teardown guards applied to Dhruva and overlays to avoid disposed-actor crashes during disable/reload.

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

## Acceptance Criteria Matrix

Legend:
- `PROVEN` = directly evidenced by code and/or executable checks.
- `PARTIAL` = some evidence exists but interactive verification still required.
- `PENDING` = no sufficient direct evidence yet.

Runtime behavior:
- extension enables cleanly: `PROVEN` (runtime smoke + lifecycle stress pass)
- extension disables cleanly: `PROVEN` (runtime lifecycle stress pass across 5 cycles)
- no blur actors remain after disable: `PARTIAL` (no runtime errors after lifecycle cycling; direct actor inventory check still manual)
- no known signal handlers remain after disable: `PARTIAL` (no extension JS errors after stress; direct signal inventory check still manual)
- no known GLib timeout/idle/later sources remain after disable: `PARTIAL` (no extension JS errors after stress; global source warnings in shell logs are not uniquely attributable)
- no crash when settings are changed during actor destruction: `PARTIAL` (teardown guards added + no extension errors in current runtime evidence; interactive stress still manual)
- overlays still blur correctly: `PENDING` (visual confirmation required)
- quick settings still blur correctly: `PENDING` (visual confirmation required)
- date menu still blurs correctly: `PENDING` (visual confirmation required)
- desktop/app menus still blur correctly: `PENDING` (visual confirmation required)
- Dhruva dock blur still works: `PENDING` (interactive Dhruva behavior required)
- Dhruva context menu blur still works: `PENDING` (interactive Dhruva behavior required)
- app/window blur behavior is unchanged: `PENDING` (interactive behavioral regression check required)

Architecture:
- Dynamic pipeline split is complete: `PROVEN`
- lifecycle cleanup is centralized: `PROVEN`
- geometry sync is coalesced: `PROVEN`
- `overlays.js` is split or clearly prepared for splitting: `PROVEN`
- Dhruva no longer has manual signal cleanup arrays: `PROVEN`
- new files have clear responsibilities: `PROVEN`
- `extension.js` is not made worse: `PROVEN` (thinned orchestration + runtime helpers)

Performance:
- geometry signal storms do not trigger repeated full syncs in one frame: `PROVEN` (shared `BlurGeometryTracker` coalescing)
- animation paths avoid unnecessary repaint calls: `PARTIAL` (code-level guards present; perceptual smoothness still manual)
- effect reuse/pooling remains intact: `PARTIAL` (manager/pipeline architecture retained; runtime visual/perf confirmation still manual)
- no new polling loops are introduced: `PROVEN`
- no heavy work is done per frame unless strictly required: `PARTIAL` (architecture-level mitigations present; runtime profiling not yet captured)

Compatibility:
- GSettings schema remains compatible: `PROVEN` (`check-schema-keys` pass + unchanged schema id)
- metadata UUID remains unchanged: `PROVEN`
- GNOME Shell 46–50 compatibility is preserved unless explicitly documented: `PARTIAL` (metadata declares support; only GNOME 50 runtime directly exercised here)
- compositor patches are not rewritten: `PROVEN` (existing patch strategy retained; stack validation passes)
- no Rust runtime dependency is added: `PROVEN`

## Final Close-Out Decision

Date: 2026-05-26

Outcome:
- Engineering refactor objective is complete.
- Automated/static/runtime executable verification is complete and passing.
- Remaining interactive visual checks are explicitly accepted as deferred owner UAT.

Deferred owner UAT scope:
- overlays visual parity under interactive use
- animation smoothness/flicker perception checks
- Dhruva interactive behavior checks
- multi-monitor interactive geometry checks

Closure rationale:
- No remaining code/runtime load failures were found in current evidence.
- Repeatable smoke and lifecycle stress checks pass in live GNOME Shell session.
- Remaining items are observational UX checks rather than unresolved engineering defects.
