# Coding Conventions

*Last mapped: 2026-04-29*

## JavaScript (GJS Extension)

### Module System
- **ESM imports** — `import X from 'gi://X'`, `import { Y } from './path.js'`
- **GI bindings** — `gi://Shell`, `gi://St`, `gi://Clutter`, `gi://Meta`, `gi://GLib`, `gi://GObject`
- **Resource imports** — `resource:///org/gnome/shell/ui/main.js`
- **Conditional imports** — `await utils.import_in_shell_only('gi://St')` for code shared between shell and preferences

### Class Pattern
```javascript
// Export as named class expression (not ES6 class with extends)
export const DhruvaBlur = class DhruvaBlur {
    constructor(connections, settings, effects_manager) { ... }
    enable() { ... }
    disable() { ... }
    _private_method() { ... }  // underscore prefix for private
};
```

- **Constructor signature:** `(connections, settings, effects_manager)` — uniform across all blur components
- **Lifecycle:** `enable()` / `disable()` pattern — each component manages its own enabled state
- **Private methods:** Underscore prefix (`_blur_dock`, `_unblur_dock`, `_update_size`)
- **Logging:** `_log(str)` guarded by `this.settings.DEBUG`, `_warn(str)` always logs
- **Log prefix:** `[Blur my Shell > component_name]` with padding for alignment

### Error Handling
```javascript
// Graceful degradation pattern — try/catch with no-op fallback
try {
    this.set_property('refraction-strength', value);
} catch(e) {
    // Patch not installed — no-op
}

// Signal disconnection pattern — catch already-disposed actors
try { actor.disconnect(id); } catch (e) { }
```

### Signal Management
- **Connections class** — centralized signal tracking with `disconnect_all()` on disable
- **Direct connect** — used for actor-specific signals with manual ID tracking:
  ```javascript
  let signal_ids = [];
  signal_ids.push([actor, actor.connect('notify::x', callback)]);
  // cleanup:
  for (let [actor, id] of signal_ids) { actor.disconnect(id); }
  ```

### GObject Integration
```javascript
// Subclassing Shell.BlurEffect
new GObject.registerClass({
    GTypeName: "NativeDynamicBlurEffect"
}, class NativeDynamicBlurEffect extends Shell.BlurEffect {
    // Uses set_property() for patch-dependent properties
    // Has JS getters/setters that delegate to GObject properties
});
```

### Actor Discovery Patterns
- **By name:** `actor.get_name() === 'DhruvaContainer'`
- **By CSS class:** `actor.get_style_class_name()?.includes('context-menu-overlay')`
- **By child structure:** Walking `get_children()` looking for known types
- **Monkey-patching:** `BoxPointerModule.BoxPointer.prototype.open = function(...args) { ... }`

## C Patches

### GNOME Shell C Style
- Functions: `snake_case` — `shell_blur_effect_set_corner_radius()`
- Types: `PascalCase` — `ShellBlurEffect`
- Macros: `UPPER_SNAKE_CASE` — `SHELL_IS_BLUR_EFFECT`, `MIN_DOWNSCALE_SIZE`
- GObject property names: `kebab-case` — `"corner-radius"`, `"refraction-strength"`

### GLSL Shader Style
- Uniforms: `u_` prefix — `u_corner_radius`, `u_size`, `u_refract_size`
- Globals (refraction): `r_` prefix — `r_transition`, `r_border`, `r_gradient`
- String literals: C string concatenation with `\n` termination and column-aligned padding

### Patch Structure
- Unified diff format with `---`/`+++` markers
- Context lines for reliable application
- Grouped by logical change (declarations, functions, property registration)
- Overlay patch assumes base patch context lines

## Bash (install.sh, PKGBUILD)

- `set -euo pipefail` — strict mode
- Color output helpers: `info()`, `ok()`, `warn()`, `err()`, `die()`
- Flag parsing via `case` in `for arg in "$@"`
- Preflight validation before build
- ASCII art banner for user feedback
