---
phase: 4
name: BoxPointer Blur Preferences UI
wave: 2
depends_on: [01-PLAN.md]
files_modified:
  - blur-my-shell@aunetx/ui/boxpointer.ui
  - blur-my-shell@aunetx/preferences/boxpointer.js
  - blur-my-shell@aunetx/prefs.js
  - blur-my-shell@aunetx/preferences/menu.js
autonomous: true
---

# Plan 02 — BoxPointer Blur Preferences UI

## Objective

Create the Adw.PreferencesPage for the boxpointer component and register it in the extension's preferences window. This provides the same level of user customization as existing blur components (panel, dash, etc).

## must_haves

- [ ] GtkBuilder `.ui` template with all settings widgets
- [ ] Adw.PreferencesPage class with GSettings bindings
- [ ] Preferences page registered in `prefs.js` and visible in menu

## Tasks

<task id="01">
<title>Create boxpointer.ui GtkBuilder template</title>
<read_first>
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/ui/panel.ui
</read_first>
<action>
Create `ui/boxpointer.ui` following the exact pattern of `panel.ui`.

The template must include these Adw widgets (matching panel parity):

1. **`blur`** — `Adw.SwitchRow` — Master blur toggle
2. **`pipeline_choose_row`** — Pipeline selection row (custom widget type from panel.ui)
3. **`mode_static` / `mode_dynamic`** — `Gtk.ToggleButton` pair — Static vs dynamic blur
4. **`sigma_row` / `sigma`** — `Adw.SpinRow` — Blur radius (range 0–100, step 1)
5. **`brightness_row` / `brightness`** — `Adw.SpinRow` — Brightness (range 0.0–1.0, step 0.1)
6. **`corner_radius_row` / `corner_radius`** — `Adw.SpinRow` — Corner radius (range 0–100, step 1)
7. **`override_background`** — `Adw.SwitchRow` — Override CSS background to transparent

Group these into `Adw.PreferencesGroup` sections:
- **"Popup Menus Blur"** — blur toggle, pipeline, mode buttons
- **"Appearance"** — sigma, brightness, corner_radius (only visible when NOT using pipeline mode)
- **"Advanced"** — override_background

Use `GTypeName` = `BoxPointer` and matching template class name.
</action>
<acceptance_criteria>
- File `ui/boxpointer.ui` exists as valid GtkBuilder XML
- Contains `Adw.SwitchRow` for blur toggle with id `blur`
- Contains `Adw.SpinRow` for sigma, brightness, corner-radius
- Contains pipeline selection row
- Contains mode toggle buttons (static/dynamic)
- Contains override_background switch
- All widget IDs match the InternalChildren list in the JS class
</acceptance_criteria>
</task>

<task id="02">
<title>Create BoxPointer preferences page class</title>
<read_first>
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/preferences/panel.js
</read_first>
<action>
Create `preferences/boxpointer.js` following the exact pattern of `preferences/panel.js`:

```javascript
import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

export const BoxPointer = GObject.registerClass({
    GTypeName: 'BoxPointer',
    Template: GLib.uri_resolve_relative(
        import.meta.url, '../ui/boxpointer.ui', GLib.UriFlags.NONE
    ),
    InternalChildren: [
        'blur',
        'pipeline_choose_row',
        'mode_static',
        'mode_dynamic',
        'sigma_row',
        'sigma',
        'brightness_row',
        'brightness',
        'corner_radius_row',
        'corner_radius',
        'override_background',
    ],
}, class BoxPointer extends Adw.PreferencesPage {
    constructor(preferences, pipelines_manager, pipelines_page) {
        super({});
        
        this.preferences = preferences;
        this.pipelines_manager = pipelines_manager;
        this.pipelines_page = pipelines_page;

        // Bind settings using Gio.SettingsBindFlags.DEFAULT
        this.preferences.boxpointer.settings.bind(
            'blur', this._blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._pipeline_choose_row.initialize(
            this.preferences.boxpointer,
            this.pipelines_manager,
            this.pipelines_page
        );

        this.change_blur_mode(
            this.preferences.boxpointer.STATIC_BLUR, true
        );

        this._mode_static.connect('toggled',
            () => this.preferences.boxpointer.STATIC_BLUR = 
                  this._mode_static.active
        );
        this.preferences.boxpointer.STATIC_BLUR_changed(
            () => this.change_blur_mode(
                this.preferences.boxpointer.STATIC_BLUR, false
            )
        );

        this.preferences.boxpointer.settings.bind(
            'sigma', this._sigma, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.boxpointer.settings.bind(
            'brightness', this._brightness, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.boxpointer.settings.bind(
            'corner-radius', this._corner_radius, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.boxpointer.settings.bind(
            'override-background',
            this._override_background, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    }

    change_blur_mode(is_static_blur, first_run) {
        this._mode_static.set_active(is_static_blur);
        this._mode_dynamic.set_active(!is_static_blur);

        // Show sigma/brightness only in dynamic mode
        // (static mode uses pipeline settings)
        this._sigma_row.visible = !is_static_blur;
        this._brightness_row.visible = !is_static_blur;
        this._corner_radius_row.visible = !is_static_blur;
    }
});
```

Key implementation notes:
- `GTypeName` must be unique — use `'BoxPointer'` (not conflicting with Shell's BoxPointer)
- Template path resolves to `../ui/boxpointer.ui`
- All `InternalChildren` must exactly match widget IDs in the `.ui` file
- `change_blur_mode` toggles sigma/brightness/corner-radius row visibility based on static vs dynamic mode
</action>
<acceptance_criteria>
- File `preferences/boxpointer.js` exists
- Exports `BoxPointer` class extending `Adw.PreferencesPage`
- `GTypeName` is `'BoxPointer'`
- All 11 `InternalChildren` listed
- GSettings bindings use `Gio.SettingsBindFlags.DEFAULT`
- `change_blur_mode` toggles row visibility
- Pipeline choose row initialized with boxpointer preferences
</acceptance_criteria>
</task>

<task id="03">
<title>Register preferences page in prefs.js and menu</title>
<read_first>
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/prefs.js
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/preferences/menu.js
</read_first>
<action>
1. In `prefs.js`, add import:
```javascript
import { BoxPointer } from './preferences/boxpointer.js';
```

2. In the `fillPreferencesWindow` method, after existing page additions, add:
```javascript
const boxpointer_page = new BoxPointer(
    this.preferences, this.pipelines_manager, pipelines_page
);
boxpointer_page.title = "Popup Menus";
boxpointer_page.icon_name = "view-list-symbolic";
window.add(boxpointer_page);
```

3. In `preferences/menu.js` (the sidebar navigation), add a menu entry for the boxpointer page in the appropriate position (after Panel, before Dash):
```javascript
{ title: "Popup Menus", icon: "view-list-symbolic", page: boxpointer_page }
```

Use the icon `"view-list-symbolic"` (or `"popup-menu-symbolic"` if available) to match the menu metaphor.
</action>
<acceptance_criteria>
- `prefs.js` imports `BoxPointer` from `./preferences/boxpointer.js`
- `BoxPointer` page instantiated with preferences, pipelines_manager, pipelines_page
- Page title is "Popup Menus"
- Page has a symbolic icon
- Page is added to the preferences window via `window.add()`
- Menu entry added in `menu.js` (if applicable to this extension's navigation pattern)
</acceptance_criteria>
</task>

## Verification

- [ ] Opening blur-my-shell preferences shows "Popup Menus" page
- [ ] Page contains blur toggle, pipeline selector, mode buttons
- [ ] Page shows sigma/brightness/corner-radius spinners in dynamic mode
- [ ] Page hides sigma/brightness/corner-radius in static (pipeline) mode
- [ ] Toggling blur on/off immediately affects active popup menus
- [ ] Changing sigma value changes blur intensity in real-time
- [ ] Override background toggle makes menu background transparent/opaque
