# Technical Concerns

*Mapped: 2026-05-03*

## Critical Concerns

### 1. Upstream GNOME Shell Version Lock

**Risk: HIGH** — The entire project is pinned to GNOME Shell 50.0.

- Patches target specific line numbers in `shell-blur-effect.c`
- GNOME 51 will likely change hunk offsets, breaking patch application
- No automated detection of upstream changes
- Workaround: Manual patch refresh each GNOME release

**Files affected**: `patches/rounded_corners_mask.patch`, `patches/liquid_glass_compositor.patch`, `PKGBUILD` (source tag)

### 2. Extension Load Order Race

**Risk: MEDIUM** — Dhruva dock may not exist when blur-my-shell enables.

The `DhruvaBlur` component works around this with 4 delayed re-scans:
```javascript
// dhruva.js line 70-77
for (let delay of [500, 2000, 5000, 10000]) {
    let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
        this._scan_for_docks();
        return GLib.SOURCE_REMOVE;
    });
}
```

This is a **polling workaround** — not event-driven. If Dhruva enables after 10 seconds, blur won't attach until the next `child-added` event.

### 3. Geometry Sync Signal Storm

**Risk: MEDIUM** — `sync_geometry()` connects to 18 signals (9 on `bgActor` + 9 on `container`).

During Dhruva's magnification animation, multiple property notifications fire per frame:
- `scale-x`, `scale-y`, `translation-x`, `translation-y` all change simultaneously
- Each triggers a separate `sync_geometry()` call
- Each call does `get_transformed_position()` + `transform_stage_point()` + `set_position()` + `set_size()` + `queue_repaint()`

**No batching or debouncing is implemented.** In practice this works because Clutter coalesces repaints, but CPU overhead from redundant geometry calculations is unknown.

### 4. Settings Changes Trigger Full Rebuild

**Risk: LOW** — Dhruva settings changes (sigma, brightness, corner-radius) cause:
```javascript
// extension.js lines 684-705
this._dhruva_blur.disable();
this._dhruva_blur.enable();
```

This destroys and recreates all blur widgets, causing a brief visual flash. BoxPointer and other components handle this more granularly via `DummyPipeline`'s direct settings binding. The `DummyPipeline` already connects to `changed::sigma` etc. internally (lines 80-103 of `dummy_pipeline.js`), so the disable/re-enable in `extension.js` is **redundant** and could be removed.

## Fragile Areas

### 5. Context Menu Actor Discovery (Heuristic)

**Risk: MEDIUM** — `_blur_context_menu()` uses fragile heuristics to find menu structure:

```javascript
// dhruva.js lines 356-367
let gc = child.get_children();
if (gc && gc.length >= 2) {
    menuContainer = child;
    for (let sub of gc) {
        if (sub.constructor.name === 'DrawingArea' || ...)
            bgDrawingArea = sub;
        else if (sub.constructor.name === 'BoxLayout')
            panel = sub;
    }
}
```

This checks `constructor.name` and `get_name()` patterns, which are not stable APIs. If Dhruva changes its context menu structure, blur injection will silently fail.

### 6. Manual Signal Tracking in DhruvaBlur

The `_blur_dock()` method manually tracks signal IDs in an array:
```javascript
let signal_ids = [];
signal_ids.push([bgActor, bgActor.connect(prop, sync_geometry)]);
```

This is separate from the `Connections` wrapper used for global signals. If a signal is missed during cleanup, it becomes a dangling reference that can crash the shell on next property change.

The `BoxPointerBlur` component avoids this by using `this.connections.disconnect_all_for(actor)` — a safer pattern.

### 7. No Schema Validation

The deployed `dhruva.js` assumes GSettings schema keys (`sigma`, `brightness`, `corner-radius`, etc.) exist under the `dhruva` path. If the schema XML is missing or outdated, the extension will throw at enable time. The `apply-dhruva-fix.sh` script runs `glib-compile-schemas` but doesn't verify the XML contains dhruva keys.

## Technical Debt

### 8. Dual Deployment Model

`dhruva.js` exists in two locations:
1. `blur-my-glass-live/dhruva.js` — source of truth in this repo
2. `~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/components/dhruva.js` — deployed copy

There's no version tracking between them. Two scripts (`deploy-dhruva.sh`, `apply-dhruva-fix.sh`) do essentially the same thing with minor differences (schema compilation). This should be a single script.

### 9. Orphaned patch.tmp File

`patches/liquid_glass_compositor.patch.tmp` (12 KB) appears to be a scratch/backup file that was never cleaned up. It adds 146 bytes over the actual patch and may contain stale content.

### 10. No Preferences UI for Dhruva

The `extension.js` settings section wires up Dhruva blur/sigma/brightness/corner-radius changes, but there is no Adw.PreferencesPage for the Dhruva component. Users must modify GSettings directly via `dconf-editor` or `gsettings` CLI.

### 11. Screencast in Source Tree

`Screencast From 2026-04-29 13-02-09.mp4` (631 KB) is committed to the repo but not gitignored. Debug screencasts should be in `.scratch/` or excluded.

## Security Considerations

### 12. System Package Replacement

`gnome-shell-rounded-blur` `provides` and `conflicts` with `gnome-shell`. Installing this package replaces a core system component. If the patch introduces a crash-triggering bug, the entire desktop session is compromised.

**Mitigation**: Revert via `sudo pacman -S gnome-shell` restores stock.

### 13. No Code Signing

The PKGBUILD verifies source integrity via `b2sums` but the patch files themselves are not signed. A supply-chain attack could modify patches to inject code into the compositor (running as the user's session with full desktop access).

## Performance Considerations

### 14. Additional FBO Pass

The base patch adds one extra framebuffer object (`mask_fb`) to every blur effect render. This means every blurred actor (panel, overview, dock, popup menus) now does:

```
actor → blur → brightness → mask → screen  (was: actor → blur → brightness → screen)
```

The additional FBO copy + SDF calculation adds GPU cost per frame per blurred actor. For the mask pass with `corner_radius = 0`, the SDF evaluates to `1.0` everywhere, so the pass could theoretically be skipped but isn't.

### 15. Dhruva Magnifier Queue Repaint

Every `sync_geometry()` call explicitly invokes `pipeline.effect.queue_repaint()`:

```javascript
if (pipeline && pipeline.effect) {
    pipeline.effect.queue_repaint();
}
```

During magnification animations (hover over dock icons), this fires continuously. The repaint is necessary because the blur region changes, but combined with the signal storm (Concern #3), this may cause excessive GPU work.
