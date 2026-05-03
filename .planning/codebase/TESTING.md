# Testing

*Mapped: 2026-05-03*

## Current Test Infrastructure

### Formal Testing

**No formal test framework is configured for project-level code.**

The project includes `jasmine-gjs/` as a git subproject (used by GNOME Shell's own test suite via Meson), but:
- The PKGBUILD explicitly disables tests: `-D tests=false`
- No project-specific unit tests exist
- No CI/CD pipeline is configured
- No linting or static analysis is configured for the JS component

### Manual Verification (primary method)

All verification is manual and visual:

1. **Build verification**: `makepkg -si` completes without errors
2. **Visual verification**: Log out/in → observe blur effects render correctly
3. **Regression testing**: Compare before/after screenshots for SDF aliasing, refraction
4. **Deploy cycle**: `./deploy-dhruva.sh` → restart GNOME Shell → visual check

### Debug Tooling

| Tool | Usage |
|------|-------|
| `settings.DEBUG` flag | Enables `_log()` console output for all blur-my-shell components |
| GNOME Shell journal | `journalctl /usr/bin/gnome-shell -f` for runtime errors |
| Looking Glass | GNOME Shell's built-in JS debugger (Alt+F2 → `lg`) |
| Screencast recording | Video captures stored in project root for issue documentation |

## Verification History

### Phase 1: SDF Anti-Aliasing Fix

| Check | Method | Result |
|-------|--------|--------|
| `dist` includes interior SDF term | Code review | ✅ `min(max(q.x, q.y), 0.0)` present |
| `smoothstep` replaces `step` | Code review | ✅ `smoothstep(aa, -aa, dist)` |
| Patch applies cleanly | `patch -p1 --dry-run` | ✅ |

### Phase 2: Stacked Patch Architecture

| Check | Method | Result |
|-------|--------|--------|
| Overlay contains no base code | `grep` for mask code | ✅ 0 base references in overlay |
| Base applies independently | `makepkg` (default) | ✅ |
| Overlay applies on top | `BLUR_PATCH=liquid_glass_compositor makepkg` | ✅ |
| Net change ≤ original | Line count | ✅ +188 / -1605 |

### Phase 6: Dhruva Dock Integration

| Check | Method | Result |
|-------|--------|--------|
| `DhruvaBlur` class structure | Code review | ✅ enable/disable lifecycle |
| Signal cleanup on disable | Code review | ✅ manual ids + connections.disconnect_all |
| Context menu blur injection | Code review | ✅ allocation wait + idle fallback |
| Extension.js integration | Code review | ✅ registered in enable/disable/settings |

## Testing Gaps

### Critical gaps

1. **No automated shader validation** — SDF mask and refraction GLSL cannot be unit tested without a GPU context. Validation is purely visual.
2. **No integration tests** — Dhruva dock discovery, signal wiring, and blur lifecycle are untested programmatically.
3. **No regression tests for patches** — New upstream GNOME Shell releases may break patch application (hunk offsets, context changes).

### Lower-priority gaps

4. **No GSettings schema validation** — Dhruva schema keys are assumed to match what `DummyPipeline` expects.
5. **No performance benchmarks** — `sync_geometry()` fires on every property notify (9 properties × 2 actors = 18 potential calls per frame). No profiling data exists.
6. **No memory leak detection** — `EffectsManager` is designed to prevent RAM bleeding, but no tooling verifies this over long sessions.

## Recommended Testing Approach

Given the GNOME Shell extension context, practical testing would include:

1. **Patch application CI** — Clone upstream tag, apply patches, verify `meson setup` succeeds
2. **Schema validation** — Parse schema XML and verify all keys referenced in JS exist
3. **GJS lint** — `eslint` with GJS-compatible config for basic static analysis
4. **Deploy-test script** — Automated `deploy-dhruva.sh` + `busctl` to trigger extension reload + `journalctl` error check
