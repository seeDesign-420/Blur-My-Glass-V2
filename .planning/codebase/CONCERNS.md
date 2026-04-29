# Technical Concerns

*Last mapped: 2026-04-29*

## Active Issues

### 🔴 P0 — Dhruva Dock Blur Does Not Track Hover Resize

**Files:** `components/dhruva.js` → `_update_blur_geometry()`, `_blur_dock()`

**Problem:** When hovering the Dhruva dock, the dock animates wider (magnification effect via scaling or width change), but the blur background widget stays at its original size. The blur region does not extend to match the animated dock width.

**Root Cause (suspected):** The blur widget geometry is synced via `notify::x`, `notify::y`, `notify::width`, `notify::height`, and `notify::allocation` signals on `bgActor`. However, Dhruva's hover animation may use:
1. **CSS transitions** (easing) that don't emit property notifications during animation frames
2. **`set_scale()`** on the container rather than resizing `DhruvaBackground` directly
3. **Implicit Clutter animations** that update the visual transform but not the allocation box

The `notify::scale-x`/`notify::scale-y` signals are connected on the *container*, but the `_update_blur_geometry()` method reads `bgActor.get_allocation_box()`, which returns the layout allocation — not the visually scaled size.

**Impact:** Visual mismatch between dock size and blur region during hover interaction.

**Potential fixes:**
- Read container's `scale_x`/`scale_y` and multiply blur dimensions accordingly
- Use `get_transformed_size()` instead of `get_allocation_box()` for visual footprint
- Connect to Dhruva's animation timeline if exposed
- Poll geometry using `Clutter.Timeline` during animation

---

### 🟡 P1 — Stale Patch Temp File

**Files:** `patches/liquid_glass_compositor.patch.tmp`

**Problem:** A `.tmp` variant of the liquid glass overlay patch exists alongside the production file. This can cause confusion about which is the source of truth.

**Fix:** Delete `patches/liquid_glass_compositor.patch.tmp` or rename if it contains WIP changes.

---

### 🟡 P1 — DummyPipeline Settings Connection Leak Potential

**Files:** `conveniences/dummy_pipeline.js` lines 80–103

**Problem:** `build_effect()` connects to `this.settings.settings` (the raw GSettings object) using `connect()` but stores IDs as instance properties. If `build_effect()` is called multiple times without first calling `remove_effect()`, the previous signal connections leak — they're overwritten but never disconnected.

**Current risk:** Low — `build_effect()` is only called once in the constructor flow currently. But the code structure allows re-calling it, which would leak.

**Fix:** Call `remove_effect()` at the top of `build_effect()`, or guard against double-connect.

---

### 🟡 P1 — BoxPointer Blur Monkey-Patch Fragility

**Files:** `components/boxpointer.js` lines 36–69

**Problem:** The component monkey-patches `BoxPointerModule.BoxPointer.prototype.open` and `.close`. If GNOME Shell changes the `BoxPointer` class to use a different method signature, or if another extension also patches these methods, the blur injection breaks silently.

**Mitigation in place:** Original methods are saved and restored on `disable()`. But no version check or compatibility guard exists.

---

### 🟡 P2 — No GSettings Schema for Dhruva Component

**Problem:** The `DhruvaBlur` component reads settings from `this.settings.dhruva` (SIGMA, BRIGHTNESS, CORNER_RADIUS, REFRACTION_STRENGTH, etc.) and the extension.js wires up `_settings.dhruva.*_changed()` callbacks. However, the GSettings schema XML for these keys may not be compiled into the running extension's schema cache.

**Impact:** If the schema keys don't exist, the extension will fail silently or throw on first access.

**Status:** Need to verify `org.gnome.shell.extensions.blur-my-shell.gschema.xml` includes `dhruva` child schema with all expected keys.

---

### 🟢 P3 — Delayed Dock Scan Timers

**Files:** `components/dhruva.js` lines 68–75

**Observation:** Four `GLib.timeout_add()` timers at 500ms, 2s, 5s, 10s handle extension load-order races. These are correctly cleaned up in `disable()`. The pattern is pragmatic but adds unnecessary re-scans if Dhruva is already discovered on the first scan.

**Improvement:** Cancel remaining timers once a dock is found.

---

### 🟢 P3 — No Multi-Monitor Testing for Dhruva Dock Blur

**Problem:** `_blur_dock()` uses `DummyPipeline.create_background_with_effect()` which creates a dynamic blur widget. The blur samples from the screen behind the widget. On multi-monitor setups, the blur widget may sample the wrong monitor's content if the dock is on a non-primary monitor.

**Status:** Not verified. The BoxPointer component handles this with `Main.layoutManager.findMonitorForActor()`, but DhruvaBlur does not do per-monitor aware background creation.

---

## Technical Debt

| Item | Severity | Location | Description |
|------|----------|----------|-------------|
| Upstream tests disabled | Low | `PKGBUILD` line 117 | `-D tests=false` skips all upstream unit tests |
| No CI pipeline | Medium | Project-wide | Build verification is manual only |
| `.tmp` patch file | Low | `patches/` | Stale WIP file should be cleaned up |
| No screenshot regression tests | Medium | Project-wide | Visual changes tracked only by human inspection |
| Hard-coded GNOME Shell version | Low | `PKGBUILD` line 12 | `pkgver=50.0` must be manually updated for new releases |

## Security Considerations

- **System package replacement** — The PKGBUILD replaces the system `gnome-shell` package. A corrupted patch could break the login session entirely.
- **No integrity verification** — The patches themselves are not checksummed independently. Only the upstream source has `b2sums` verification.
- **Extension runs with shell privileges** — blur-my-shell components execute in the GNOME Shell process with full compositor access.
