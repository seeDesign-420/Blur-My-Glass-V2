---
phase: 4
name: BoxPointer Blur Component
wave: 1
depends_on: []
files_modified:
  - blur-my-shell@aunetx/components/boxpointer.js
  - blur-my-shell@aunetx/conveniences/keys.js
  - blur-my-shell@aunetx/schemas/org.gnome.shell.extensions.blur-my-shell.gschema.xml
  - blur-my-shell@aunetx/extension.js
autonomous: true
---

# Plan 01 — BoxPointer Blur Component (Core + GSettings)

## Objective

Create the core `BoxPointerBlur` component module and register it with the extension's settings/schema system. This plan delivers the blur effect itself + GSettings schema. Preferences UI is in Plan 02.

## Customization Parity Requirements

Every existing blur-my-shell component exposes these settings (per the `keys.js` + GSchema pattern):

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `blur` | `b` | Master enable/disable toggle | `true` |
| `pipeline` | `s` | Pipeline ID for effect chain | `"pipeline_default"` |
| `sigma` | `i` | Blur radius (px) | `30` |
| `brightness` | `d` | Brightness multiplier | `0.6` |
| `corner-radius` | `i` | Rounded corner mask radius (px) | `24` |
| `refraction-strength` | `d` | Liquid glass refraction intensity | `0.0` |

Additional component-specific settings for BoxPointer:

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `static-blur` | `b` | Static vs dynamic blur mode | `true` |
| `override-background` | `b` | Override the BoxPointer CSS background to transparent | `true` |

## must_haves

- [ ] `BoxPointerBlur` class in `components/boxpointer.js` with `enable()` / `disable()` / `reset()` lifecycle
- [ ] GSettings schema with all parity settings under `org.gnome.shell.extensions.blur-my-shell.boxpointer`
- [ ] Keys registered in `conveniences/keys.js`
- [ ] Component instantiated and wired in `extension.js`
- [ ] Blur applies to Quick Settings, Date Menu, and popup menus via BoxPointer prototype override

## Tasks

<task id="01">
<title>Create GSettings schema for boxpointer component</title>
<read_first>
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/schemas/org.gnome.shell.extensions.blur-my-shell.gschema.xml
</read_first>
<action>
Add a new schema block to the GSettings XML file, following the exact pattern of the `panel` schema:

```xml
<schema id="org.gnome.shell.extensions.blur-my-shell.boxpointer"
    path="/org/gnome/shell/extensions/blur-my-shell/boxpointer/">
    <key type="b" name="blur">
        <default>true</default>
        <summary>Blur popup menus</summary>
    </key>
    <key type="b" name="static-blur">
        <default>true</default>
        <summary>Use static blur mode</summary>
    </key>
    <key type="s" name="pipeline">
        <default>"pipeline_default"</default>
        <summary>Pipeline to use</summary>
    </key>
    <key type="b" name="customize">
        <default>false</default>
        <summary>Customize blur settings</summary>
    </key>
    <key type="i" name="sigma">
        <default>30</default>
        <summary>Blur sigma</summary>
    </key>
    <key type="d" name="brightness">
        <default>0.6</default>
        <summary>Brightness</summary>
    </key>
    <key type="(dddd)" name="color">
        <default>(0.,0.,0.,0.)</default>
        <summary>Color overlay</summary>
    </key>
    <key type="d" name="noise-amount">
        <default>0.</default>
        <summary>Noise amount</summary>
    </key>
    <key type="d" name="noise-lightness">
        <default>0.</default>
        <summary>Noise lightness</summary>
    </key>
    <key type="b" name="override-background">
        <default>true</default>
        <summary>Override background to transparent</summary>
    </key>
    <key type="i" name="corner-radius">
        <default>24</default>
        <summary>Corner radius</summary>
    </key>
    <key type="d" name="refraction-strength">
        <default>0.0</default>
        <summary>Refraction strength</summary>
    </key>
    <key type="d" name="chromatic-aberration">
        <default>0.0</default>
        <summary>Chromatic aberration</summary>
    </key>
</schema>
```

Insert this block after the `panel` schema block (before `dash-to-dock`).
</action>
<acceptance_criteria>
- GSchema XML contains `schema id="org.gnome.shell.extensions.blur-my-shell.boxpointer"`
- All 13 keys present: blur, static-blur, pipeline, customize, sigma, brightness, color, noise-amount, noise-lightness, override-background, corner-radius, refraction-strength, chromatic-aberration
- Schema compiles: `glib-compile-schemas` exits 0
</acceptance_criteria>
</task>

<task id="02">
<title>Register boxpointer settings keys</title>
<read_first>
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/conveniences/keys.js
</read_first>
<action>
Add a new `boxpointer` component block to the `KEYS` array, following the exact pattern of the `panel` block:

```javascript
{
    component: "boxpointer", schemas: [
        { type: Type.B, name: "blur" },
        { type: Type.B, name: "static-blur" },
        { type: Type.S, name: "pipeline" },
        { type: Type.I, name: "sigma" },
        { type: Type.D, name: "brightness" },
        { type: Type.D, name: "refraction-strength" },
        { type: Type.B, name: "override-background" },
        { type: Type.I, name: "corner-radius" },
    ]
},
```

Insert after the `panel` block. Also add corresponding deprecated keys block:

```javascript
{
    component: "boxpointer", schemas: [
        { type: Type.B, name: "customize" },
        { type: Type.C, name: "color" },
        { type: Type.D, name: "noise-amount" },
        { type: Type.D, name: "noise-lightness" },
    ]
},
```
</action>
<acceptance_criteria>
- `keys.js` contains `component: "boxpointer"` in KEYS array
- At least 8 schemas defined: blur, static-blur, pipeline, sigma, brightness, refraction-strength, override-background, corner-radius
- Deprecated keys block also present
</acceptance_criteria>
</task>

<task id="03">
<title>Create BoxPointerBlur component module</title>
<read_first>
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/components/panel.js
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/components/appfolders.js
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/conveniences/pipeline.js
- /home/thomas/blur-my-glass-live/src/gnome-shell/js/ui/boxpointer.js
- /home/thomas/blur-my-glass-live/src/gnome-shell/js/ui/popupMenu.js
</read_first>
<action>
Create `components/boxpointer.js` following the `PanelBlur` pattern:

**Class: `BoxPointerBlur`**

Constructor params: `(connections, settings, effects_manager)`

**`enable()` method:**
1. Store reference to `BoxPointer.BoxPointer.prototype`
2. Monkey-patch `BoxPointer.prototype.open()` to intercept popup menu opens:
   - After original `open()` completes, call `this._blur_boxpointer(boxpointer_instance)`
3. Monkey-patch `BoxPointer.prototype.close()`:
   - Before original `close()`, call `this._unblur_boxpointer(boxpointer_instance)`
4. Scan existing open BoxPointers and blur them

**`_blur_boxpointer(boxpointer)` method:**
1. Check if already blurred (look for `bms-boxpointer-blurred-widget` name)
2. Get the `boxpointer.bin` (the content container)
3. Create `Meta.BackgroundGroup` sized to boxpointer allocation
4. Create `Pipeline` with `this.settings.boxpointer.PIPELINE` (or `DummyPipeline` for dynamic mode)
5. Insert background_group at index 0 of boxpointer
6. If `settings.boxpointer.OVERRIDE_BACKGROUND`: override CSS on boxpointer's `_border` to transparent
7. Connect to `boxpointer.connect('notify::allocation', ...)` to resize blur on allocation change
8. Track in `this._blurred_boxpointers` Map (keyed by boxpointer instance)

**`_unblur_boxpointer(boxpointer)` method:**
1. Look up boxpointer in `this._blurred_boxpointers` Map
2. Remove background_group child
3. Restore CSS background
4. Disconnect allocation signal
5. Delete from Map

**`disable()` method:**
1. Restore original `BoxPointer.prototype.open` and `close`
2. Iterate `this._blurred_boxpointers` and unblur each
3. Clear Map, disconnect all signals

**`reset()` method:**
1. `disable()` then `enable()`

**Key implementation details:**
- Use `import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js'` for prototype access
- Use `import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js'` for menu detection
- The blur target is the `St.Widget` (`BoxPointer`) itself, not its `bin` child
- The background_group must be sized to match `boxpointer.get_allocation_box()`
- Use `PaintSignals` for HACKS_LEVEL=1 compatibility (same as panel.js)
</action>
<acceptance_criteria>
- File `components/boxpointer.js` exists with `export const BoxPointerBlur = class BoxPointerBlur`
- Class has `enable()`, `disable()`, `reset()` lifecycle methods
- `enable()` monkey-patches `BoxPointer.prototype.open` and hooks blur injection
- `disable()` restores original prototype methods and cleans up all blur actors
- Uses `Pipeline` or `DummyPipeline` based on `static-blur` setting (matching panel pattern)
- Respects `settings.boxpointer.BLUR` toggle
- Respects `settings.boxpointer.OVERRIDE_BACKGROUND` for CSS transparency
- Creates `Meta.BackgroundGroup` with `bms-boxpointer-blurred-widget` name
</acceptance_criteria>
</task>

<task id="04">
<title>Register component in extension.js</title>
<read_first>
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/extension.js
</read_first>
<action>
Wire the new component into the extension lifecycle:

1. Add import at top:
```javascript
import { BoxPointerBlur } from './components/boxpointer.js';
```

2. In `enable()`, inside the `init()` closure (around line 60), add after the existing component instantiations:
```javascript
this._boxpointer_blur = new BoxPointerBlur(
    connection,
    this._settings,
    this._effects_manager
);
```

3. After all component instantiations, in the settings connection block, add:
```javascript
this._settings.boxpointer.BLUR_changed(() => {
    if (this._settings.boxpointer.BLUR)
        this._boxpointer_blur.enable();
    else
        this._boxpointer_blur.disable();
});
```

4. In the initial enable block, add:
```javascript
if (this._settings.boxpointer.BLUR)
    this._boxpointer_blur.enable();
```

5. In `disable()`, add:
```javascript
this._boxpointer_blur.disable();
this._boxpointer_blur = null;
```
</action>
<acceptance_criteria>
- `extension.js` imports `BoxPointerBlur` from `./components/boxpointer.js`
- `BoxPointerBlur` instantiated in `enable()` with `connection, settings, effects_manager`
- `BLUR_changed` callback toggles enable/disable
- `disable()` calls `this._boxpointer_blur.disable()` and nulls reference
</acceptance_criteria>
</task>

## Verification

- [ ] Schema compiles with `glib-compile-schemas`
- [ ] Extension loads without errors in GNOME Shell log
- [ ] Quick Settings dropdown shows blur behind it
- [ ] Date Menu dropdown shows blur behind it
- [ ] Right-click context menu on desktop shows blur
- [ ] Toggling `blur` setting on/off enables/disables blur in real-time
- [ ] Changing `sigma` visually changes blur intensity
- [ ] Changing `corner-radius` visually changes mask shape
- [ ] Disabling extension fully cleans up — no orphaned actors
- [ ] Re-enabling extension restores blur without errors
