# Codex Agent Instructions — Blur My Glass Backend Refactor

## Project Context

This repository is a GNOME Shell extension plus optional patched GNOME Shell/Mutter compositor work for advanced blur/glass behavior.

The current codebase has improved significantly, especially around overlay controllers, registries, popup hooks, and quick settings blur surfaces. However, the backend/runtime layer still needs stabilization before any Rust refactor is attempted.

The goal of this task is **not** to rewrite the whole extension and not to move the live GNOME Shell backend to Rust.

The goal is to refactor the existing GJS backend/runtime into a safer, smaller, more maintainable architecture.

---

## Important Decision

Do **not** refactor the live extension backend to Rust yet.

Rust may be introduced later for tooling, validation, diagnostics, or packaging helpers, but the GNOME Shell actor/runtime layer must remain in GJS for now.

The following must stay in GJS:

- actor discovery
- Clutter/St actor signal handling
- shell popup/menu hooks
- blur surface ownership
- `Shell.BlurEffect` property mutation
- `Meta.BackgroundGroup` insertion
- GSettings live binding
- session mode handling
- component enable/disable lifecycle

Rust may be considered later for:

- schema validation CLI
- patch validation CLI
- repo doctor/health-check tool
- GNOME version compatibility checker
- preset/profile import/export tooling
- diagnostics/log collection helper

Do not introduce a Rust runtime dependency into GNOME Shell during this refactor.

---

## Refactor Goal

Refactor the JS backend/runtime layer for:

1. lifecycle safety
2. less duplicated blur surface logic
3. smoother geometry syncing
4. cleaner settings routing
5. better separation between components, blur pipelines, and overlay controllers
6. future maintainability across GNOME 46–50+

Keep user-facing behavior the same unless a bug fix requires a small internal behavior change.

---

## Hard Rules

### Do not overreach

Do not rewrite the entire extension.

Do not rewrite the compositor patches.

Do not change the extension UUID.

Do not remove existing settings keys.

Do not rename GSettings keys unless a compatibility migration is provided.

Do not change user-facing defaults unless explicitly required.

Do not add a Rust backend.

Do not introduce native code into the shell process.

Do not add heavy dependencies.

Do not rely on polling when a signal or lifecycle hook is available.

### GNOME Shell safety rules

Every signal connection must be disconnected during disable/destroy.

Every GLib timeout, idle source, or later callback must be removable or guarded against stale state.

Every injected actor must be destroyed or removed during disable/destroy.

Every blur effect must be removed from its actor or returned to the pool safely.

Every settings callback must tolerate the target actor/effect no longer existing.

Avoid `run_dispose()` as a lazy replacement for disconnecting signals.

Avoid untracked `actor.connect(...)`.

Avoid untracked `GLib.timeout_add(...)`.

Avoid raw `setTimeout(...)` in shell runtime code.

Avoid empty `catch` blocks unless there is a debug-only warning or clear comment explaining why the exception is safe to ignore.

---

## Primary Refactor Targets

Focus first on these files:

```text
extension/src/conveniences/effects_manager.js
extension/src/conveniences/dummy_pipeline.js
extension/src/conveniences/connections.js
extension/src/components/overlays.js
extension/src/components/dhruva.js
extension/src/extension.js
```

Secondary files may be touched only as needed:

```text
extension/src/conveniences/keys.js
extension/src/conveniences/settings.js
extension/src/components/*.js
extension/schemas/*.xml
```

Do not modify patches unless required for build correctness.

---

## Phase 1 — Fix Known Lifecycle Bugs

### 1. Fix `EffectsManager` actor tracking

Current issue:

`connect_to_destroy()` connects a destroy handler to the current effect actor, but actor tracking can become stale if the effect is moved to another actor.

Expected behavior:

- if the effect actor changes, disconnect the old destroy handler
- connect to the new actor's `destroy`
- update the stored old actor reference immediately
- safely handle null/destroyed actors

Implementation expectation:

```js
if (actor && actor !== effect.old_actor) {
    effect.old_actor_id = actor.connect('destroy', () => {
        this.remove(effect, true);
    });
    effect.old_actor = actor;
}
```

Also ensure cleanup resets:

```js
effect.old_actor = null;
effect.old_actor_id = null;
```

### 2. Defend settings callbacks

In the blur pipeline, all settings callbacks must check that the effect still exists before mutating it.

Bad:

```js
'changed::sigma', () => this.effect.unscaled_radius = value
```

Good:

```js
'changed::sigma', () => {
    if (!this.effect)
        return;

    this.effect.unscaled_radius = value;
}
```

Apply this to:

- sigma
- brightness
- corner radius
- vibrancy
- refraction strength
- refraction radius
- refraction inner radius
- any future effect property

---

## Phase 2 — Rename and Split `DummyPipeline`

`DummyPipeline` is no longer dummy. It is now the real dynamic blur binding/pipeline.

### Required change

Rename it conceptually to:

```text
DynamicBlurPipeline
```

Preferred file:

```text
extension/src/blur/dynamic_blur_pipeline.js
```

or, if minimizing churn:

```text
extension/src/conveniences/dynamic_blur_pipeline.js
```

### Backwards compatibility

If other modules still import `DummyPipeline`, preserve compatibility temporarily:

```js
export class DynamicBlurPipeline {
    ...
}

export const DummyPipeline = DynamicBlurPipeline;
```

### Responsibility split

The current pipeline likely owns too much. Move toward these responsibilities:

```text
DynamicBlurPipeline
  owns the blur effect and property bindings

BlurBackgroundSurface
  owns the background actor / Meta.BackgroundGroup

BlurEffectBinding
  owns settings-to-effect property synchronization
```

If a full split is too risky in one pass, do the rename first and leave TODO comments for later extraction.

---

## Phase 3 — Introduce a `DisposableStore`

Create a shared lifecycle utility:

```text
extension/src/runtime/disposable_store.js
```

It should own and clean up:

- GObject signal connections
- GLib timeout sources
- GLib idle sources
- Meta later callbacks where possible
- injected actors
- blur pipelines/effects
- arbitrary cleanup callbacks

Suggested API:

```js
export class DisposableStore {
    constructor() {}

    addSignal(object, signalName, callback) {}
    addSource(sourceId) {}
    addActor(actor) {}
    addPipeline(pipeline) {}
    addCleanup(callback) {}

    dispose() {}
}
```

Expected behavior:

- `dispose()` is idempotent
- cleanup runs in reverse order where useful
- exceptions during cleanup are caught and logged in debug mode
- no cleanup callback should prevent later cleanup callbacks from running
- destroyed/null objects should be ignored safely

### Use it in

- Dhruva blur component
- overlay controllers
- quick settings control blur layer
- popup hook manager
- runtime/component registry, where appropriate

The goal is to remove manual arrays like:

```js
this.signal_ids = [];
```

and replace them with owned cleanup.

---

## Phase 4 — Add Frame-Coalesced Geometry Sync

Geometry syncing is currently too eager. Many actor signals directly trigger full geometry sync.

Create:

```text
extension/src/runtime/blur_geometry_tracker.js
```

or:

```text
extension/src/blur/geometry_tracker.js
```

### Required behavior

The tracker should:

- listen to geometry-related signals
- queue a single geometry sync per frame
- avoid duplicate sync work during animations
- skip destroyed/unmapped actors
- clamp invalid width/height
- avoid redundant `set_position()` and `set_size()` calls
- optionally queue repaint only when geometry changed

### Geometry signals

Use a centralized list:

```js
const GEOMETRY_SIGNALS = [
    'notify::x',
    'notify::y',
    'notify::width',
    'notify::height',
    'notify::scale-x',
    'notify::scale-y',
    'notify::translation-x',
    'notify::translation-y',
    'notify::pivot-point',
    'notify::visible',
    'notify::mapped',
];
```

### Required scheduling pattern

Signal callbacks should call:

```js
tracker.queueSync();
```

not:

```js
tracker.syncNow();
```

Use `Meta.later_add(Meta.LaterType.BEFORE_REDRAW, ...)` where available. If compatibility requires fallback behavior, use a tracked GLib idle source.

The callback must be guarded:

```js
if (this._disposed)
    return GLib.SOURCE_REMOVE;
```

---

## Phase 5 — Split `overlays.js`

`extension/src/components/overlays.js` has grown too large and contains multiple subsystems.

Split it into smaller files.

Suggested structure:

```text
extension/src/overlays/constants.js
extension/src/overlays/actor_utils.js
extension/src/overlays/geometry.js
extension/src/overlays/overlay_surface_controller.js
extension/src/overlays/popup_overlay_controller.js
extension/src/overlays/popup_hook_manager.js
extension/src/overlays/quick_settings_control_surface.js
extension/src/overlays/quick_settings_control_layer.js
extension/src/overlays/overlay_surface_registry.js
extension/src/components/overlays.js
```

`components/overlays.js` should become a thin entry point that wires the overlay subsystem into the main extension lifecycle.

### Rules

- Preserve behavior.
- Preserve setting names.
- Preserve popup behavior.
- Preserve animation grace periods.
- Do not remove target-specific tuning.
- Do not change quick settings blur behavior unless fixing a clear bug.

---

## Phase 6 — Bring Dhruva onto the Shared Surface Model

`dhruva.js` is still more fragile than the new overlay subsystem.

Refactor it so it uses the same lifecycle and geometry infrastructure as overlays.

Suggested structure:

```text
extension/src/integrations/dhruva_target_resolver.js
extension/src/integrations/dhruva_dock_surface_controller.js
extension/src/integrations/dhruva_context_menu_surface_controller.js
extension/src/components/dhruva.js
```

### Required improvements

- avoid duplicate actor-tree scans
- use `DisposableStore`
- use `BlurGeometryTracker`
- avoid manual signal arrays
- set `enabled = true` before scan/hook work starts
- centralize actor-name/style-class heuristics in one resolver
- gracefully handle Dhruva actor changes/reparenting
- do not assume every actor exists forever

The actor-name heuristics are acceptable for now, but they must be isolated.

---

## Phase 7 — Thin Out `extension.js`

`extension.js` should eventually become orchestration only.

Introduce, if practical:

```text
extension/src/runtime/component_registry.js
extension/src/runtime/settings_router.js
extension/src/runtime/session_mode_controller.js
extension/src/runtime/capability_service.js
```

### Component registry

Each component should be declared with metadata:

```js
{
    key: 'overlays',
    settingKey: KEYS.OVERLAY.BLUR,
    factory: () => new OverlaysBlur(...),
}
```

The registry should handle:

- enable
- disable
- rebuild
- settings toggle
- session mode changes
- cleanup ordering

Do this incrementally. Do not risk breaking startup just to make `extension.js` smaller.

---

## Phase 8 — Add Validation Tooling

Add scripts before major compositor changes.

Suggested scripts:

```text
scripts/check-schema-keys.js
scripts/lint-gjs.sh
scripts/check-untracked-connects.sh
scripts/validate-patches.sh
```

### `check-schema-keys.js`

Validate that every key referenced in `keys.js` exists in the schema XML.

### `check-untracked-connects.sh`

Search for raw `.connect(` calls outside approved lifecycle utilities.

Allowlist examples:

- `DisposableStore.addSignal`
- `Connections.connect`
- low-level wrapper utilities

Flag direct use in components/controllers.

### `validate-patches.sh`

Perform dry-run patch validation against the expected GNOME Shell source version.

This script should fail loudly if:

- a patch no longer applies
- expected compositor symbols are missing
- patch ordering is invalid

### `lint-gjs.sh`

At minimum:

- run syntax checks where possible
- grep for `setTimeout`
- grep for empty `catch`
- grep for untracked GLib sources
- grep for direct actor `.connect(` calls

---

## Acceptance Criteria

The refactor is acceptable only if all of the following are true:

### Runtime behavior

- extension enables cleanly
- extension disables cleanly
- no blur actors remain after disable
- no known signal handlers remain after disable
- no known GLib timeout/idle/later sources remain after disable
- no crash when settings are changed during actor destruction
- overlays still blur correctly
- quick settings still blur correctly
- date menu still blurs correctly
- desktop/app menus still blur correctly
- Dhruva dock blur still works
- Dhruva context menu blur still works
- app/window blur behavior is unchanged

### Architecture

- `DummyPipeline` is renamed or compatibility-wrapped
- lifecycle cleanup is centralized
- geometry sync is coalesced
- `overlays.js` is split or clearly prepared for splitting
- Dhruva no longer has manual signal cleanup arrays
- new files have clear responsibilities
- `extension.js` is not made worse

### Performance

- geometry signal storms do not trigger repeated full syncs in one frame
- animation paths avoid unnecessary repaint calls
- effect reuse/pooling remains intact
- no new polling loops are introduced
- no heavy work is done per frame unless strictly required

### Compatibility

- GSettings schema remains compatible
- metadata UUID remains unchanged
- GNOME Shell 46–50 compatibility is preserved unless explicitly documented
- compositor patches are not rewritten
- no Rust runtime dependency is added

---

## Manual Test Plan

After implementation, run these manual checks in a GNOME Shell session.

### Basic lifecycle

1. Enable extension.
2. Disable extension.
3. Re-enable extension.
4. Watch journal/logs for warnings or errors.
5. Confirm no leftover blur actors or stuck blur backgrounds.

### Settings stress

1. Open the preferences UI.
2. Toggle overlay blur on/off repeatedly.
3. Adjust sigma, brightness, corner radius, vibrancy, and refraction values.
4. Do this while opening and closing menus.
5. Confirm no crash and no stale blur.

### Overlay checks

Test blur on:

- quick settings
- date menu/calendar
- notifications
- OSD
- app menu
- desktop right-click menu
- popup submenus

### Animation checks

While opening/closing overlays:

- confirm blur does not disappear too early
- confirm blur does not lag behind geometry
- confirm close animations remain smooth
- confirm no flicker during rapid open/close

### Dhruva checks

If Dhruva is installed:

- dock blur attaches correctly
- context menu blur attaches correctly
- dock auto-hide works
- dock magnification/animation does not cause jitter
- disabling Blur My Glass removes all Dhruva blur actors

### Multi-monitor checks

- open overlays on each monitor
- move windows between monitors
- test dock/menu behavior on secondary monitor
- confirm geometry is correct

---

## Logging Guidelines

Add debug logging, but keep it quiet by default.

Preferred helper:

```js
debugLog(domain, message, error = null) {
    if (!this._debug)
        return;

    log(`[Blur My Glass][${domain}] ${message}`);

    if (error)
        logError(error);
}
```

Use debug warnings for swallowed exceptions.

Do not spam logs during every animation frame.

---

## Coding Style

Keep code idiomatic GJS.

Prefer small classes with clear ownership.

Prefer explicit cleanup over clever automatic disposal.

Prefer readable code over abstract framework-like patterns.

Avoid large "god" files.

Avoid global mutable state unless GNOME Shell APIs require it.

Avoid deeply nested actor-tree logic inside component classes; move that to resolver/helper modules.

Name classes after what they own:

Good:

```text
OverlaySurfaceController
BlurGeometryTracker
DynamicBlurPipeline
PopupHookManager
DisposableStore
```

Bad:

```text
Manager2
Helper
Stuff
DummyPipeline
GlassThing
```

---

## Suggested Commit Order

Use small commits.

1. `fix: update EffectsManager actor destroy tracking`
2. `refactor: add DisposableStore lifecycle utility`
3. `refactor: replace Dhruva manual signal cleanup`
4. `refactor: rename DummyPipeline to DynamicBlurPipeline`
5. `refactor: add coalesced BlurGeometryTracker`
6. `refactor: apply geometry tracker to overlays`
7. `refactor: split overlays subsystem modules`
8. `refactor: port Dhruva to shared surface model`
9. `chore: add schema and lifecycle validation scripts`
10. `docs: document backend architecture and Rust decision`

---

## Final Reminder

This refactor is about making the existing GJS backend safe and maintainable.

Do not chase Rust yet.

Do not rewrite visual behavior.

Do not touch compositor patches unless required.

Stability, cleanup, and smooth frame behavior are the priorities.
