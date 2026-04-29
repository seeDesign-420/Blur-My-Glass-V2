# Testing

*Last mapped: 2026-04-29*

## Test Infrastructure

### Upstream GNOME Shell Tests
The upstream GNOME Shell source (at `src/gnome-shell/tests/`) includes a unit test suite:
- **Framework:** jasmine-gjs (pinned at commit `856465dd`)
- **Runner:** `gnome-shell-dbus-runner.py` — DBus test harness
- **Unit tests:** `tests/unit/*.js` — jsParse, params, versionCompare, url, insertSorted, markup, highlighter, extensionUtils, signalTracker, etc.
- **Fixtures:** `tests/unit/fixtures/extensions/` — invalid/valid extension metadata for validation tests
- **Build config:** `meson_options` has `-D tests=false` — **upstream tests are disabled** in the PKGBUILD

### Project-Level Testing
**There is no project-specific test suite.** The project relies on:
1. Build verification (patch applies + compiles)
2. Manual visual verification (log in and observe blur effects)
3. GNOME Shell journal logs (`journalctl -f /usr/bin/gnome-shell`)

## Verification Approach

### Build Verification
```bash
# Default build (base patch only)
makepkg -si

# Liquid glass build (base + overlay)
BLUR_PATCH=liquid_glass_compositor makepkg -si

# Clean rebuild
./install.sh --clean
./install.sh --clean --liquid-glass
```
**Success criteria:** No compilation errors or warnings. Package installs without conflict.

### Visual Verification (Manual)
| Check | How |
|-------|-----|
| Rounded corners AA | Set `corner-radius` to 24px, inspect edges at 2× zoom — should be smooth, no stairstepping |
| Liquid glass refraction | Enable overlay, open Quick Settings — background should warp with zoom-lens effect |
| BoxPointer blur | Right-click desktop or open Quick Settings — popup should have blur behind content |
| Dhruva dock blur | Hover dock — blur should follow background panel size/position |
| Enable/disable cycle | Toggle extension on/off via `gnome-extensions enable/disable blur-my-shell@aunetx` — no errors in journal |

### Debug Logging
```javascript
// All components use guarded logging
if (this.settings.DEBUG)
    console.log(`[Blur my Shell > component]    ${str}`);
```
Enable via blur-my-shell preferences → Debug toggle. Observe via:
```bash
journalctl -f /usr/bin/gnome-shell | grep "Blur my Shell"
```

## Testing Gaps

| Gap | Impact | Severity |
|-----|--------|----------|
| No automated tests for patch correctness | Shader regressions only caught visually | High |
| No CI pipeline | Build breaks discovered during manual builds | Medium |
| No screenshot comparison tests | Visual regressions hard to track | Medium |
| Upstream tests disabled | Can't verify patch doesn't break upstream behavior | Low |
| No GSettings schema validation tests | Typos in key names cause silent failures | Medium |
| No multi-monitor test rig | Blur geometry bugs on multi-monitor setups | Medium |

## Recommended Test Strategy

1. **Patch validation:** Script that applies patch to fresh upstream source and compiles
2. **GSettings schema compilation:** `glib-compile-schemas --strict` against modified schemas
3. **Screenshot regression:** Capture blur regions before/after changes using `gnome-screenshot`
4. **Extension load test:** `gnome-extensions enable` + journal grep for errors
5. **Geometry smoke test:** Open/close BoxPointer and Dhruva dock, verify no allocation warnings
