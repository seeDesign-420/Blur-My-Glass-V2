# Coding Conventions

*Mapped: 2026-05-03*

## Code Style

### JavaScript (GJS / GNOME Shell Extensions)

**Module system**: ES modules with GI bindings

```javascript
import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
```

**Class pattern**: ES class syntax, exported as named `const` (not `export default`):

```javascript
export const DhruvaBlur = class DhruvaBlur {
    constructor(connections, settings, effects_manager) { ... }
    enable() { ... }
    disable() { ... }
};
```

**Private methods**: Underscore-prefixed `_method_name()` (snake_case):

```javascript
_blur_dock(container) { ... }
_scan_for_docks() { ... }
_inject_context_menu_blur(overlay, menuContainer, panel, bgDrawingArea) { ... }
```

**Variable naming**:
- `let` for mutable locals (never `var`)
- `const` for immutable bindings
- `snake_case` for local variables: `signal_ids`, `bg_manager`, `blur_widget`
- `PascalCase` for classes: `DhruvaBlur`, `DummyPipeline`
- `UPPER_CASE` for settings constants: `BLUR`, `SIGMA`, `CORNER_RADIUS`

**Doc comments**: Triple-slash `///` (Rust-style, consistent with blur-my-shell upstream):

```javascript
/// Manages blur effects for the Dhruva dock extension.
/// ...
export const DhruvaBlur = class DhruvaBlur { ... }
```

**Indentation**: 4 spaces (consistent across all JS files)

**Semicolons**: Used consistently

**String literals**: Single quotes for strings, template literals for interpolation:

```javascript
this._log(`blurring dock: ${container.get_name()}`);
```

### C / GLSL (patches)

**C naming**: GObject conventions — `shell_blur_effect_set_corner_radius()`

**GLSL strings**: Embedded in C string literals with trailing `\n`:

```c
static const gchar *mask_glsl =
"  vec2 uv = cogl_tex_coord_in[0].st;                                      \n"
"  vec2 p  = uv * u_size;                                                  \n";
```

**Uniform naming**: `u_` prefix: `u_corner_radius`, `u_size`, `u_refract_size`

**GLSL variable naming**: `r_` prefix for refraction locals: `r_transition`, `r_border`, `r_gradient`

### Bash Scripts

**Header**: `#!/usr/bin/env bash` + `set -euo pipefail` (strict mode)

**Color output**: ANSI escape codes via helper functions:

```bash
info()  { echo -e "${CYAN}::${RESET} ${BOLD}$*${RESET}"; }
ok()    { echo -e "${GREEN}✓${RESET} $*"; }
warn()  { echo -e "${YELLOW}⚠${RESET} $*"; }
err()   { echo -e "${RED}✗${RESET} $*" >&2; }
die()   { err "$@"; exit 1; }
```

## Error Handling Patterns

### JavaScript — Defensive try/catch with silent fallthrough

Signal disconnection and actor operations are wrapped in try/catch with empty catch blocks:

```javascript
// dhruva.js line 311
for (let [actor, id] of info.signal_ids) {
    try { actor.disconnect(id); } catch (e) { }
}
```

This is **intentional** — actors may be disposed by the compositor before extension cleanup runs.

### JavaScript — Guard clauses for missing actors

```javascript
_blur_dock(container) {
    if (this._blurred_docks.has(container)) return;  // idempotency
    let parent = container.get_parent();
    if (!parent) return;                              // actor not parented
    // ...
    if (!bgActor) {
        this._warn("DhruvaBackground not found in container, skipping");
        return;
    }
}
```

### JavaScript — Settings access with fallback

```javascript
// dummy_pipeline.js line 42-45
let refraction = 0.0;
try { refraction = this.settings.REFRACTION_STRENGTH || 0.0; } catch(e) {}
```

### Bash — Strict mode + die()

```bash
set -euo pipefail
# ...
if ! command -v makepkg &>/dev/null; then
    die "makepkg not found — this installer requires Arch Linux"
fi
```

## Logging Pattern

Console logging gated behind `settings.DEBUG`:

```javascript
_log(str) {
    if (this.settings.DEBUG)
        console.log(`[Blur my Shell > dhruva]        ${str}`);
}

_warn(str) {
    console.warn(`[Blur my Shell > dhruva] ${str}`);
}
```

- `_log()`: Debug-only, gated by `settings.DEBUG`
- `_warn()`: Always emitted (unexpected but non-fatal conditions)
- Consistent prefix: `[Blur my Shell > component]` with aligned spacing

## Signal Management Pattern

### Manual signal tracking (DhruvaBlur)

```javascript
let signal_ids = [];
signal_ids.push([bgActor, bgActor.connect('notify::x', sync_geometry)]);
// ...
// Cleanup:
for (let [actor, id] of info.signal_ids) {
    try { actor.disconnect(id); } catch (e) { }
}
```

### Connections wrapper (BoxPointerBlur, extension.js)

```javascript
this.connections.connect(boxpointer, 'notify::allocation', _ => this._update_size(actors));
// Cleanup:
this.connections.disconnect_all();
```

The Dhruva component uses **both patterns**: `Connections` for uiGroup/stage signals, manual `signal_ids` array for per-dock signals. This is because per-dock signals need to be disconnected individually when a single dock is removed, while global signals are bulk-disconnected on `disable()`.

## Lifecycle Pattern

All blur-my-shell components follow this contract:

```
constructor(connections, settings, effects_manager)
  → Store references, set enabled = false

enable()
  → Register signals, scan for targets, inject blur
  → Set enabled = true

disable()
  → Disconnect all signals
  → Destroy all blur widgets
  → Cancel pending timers
  → Set enabled = false
```

Timer cleanup always uses `GLib.source_remove()`. Widget cleanup always tries `parent.remove_child()` before `destroy()`.
