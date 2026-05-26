import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { update_from_old_settings } from './conveniences/settings_updater.js';
import { Settings } from './conveniences/settings.js';
import { KEYS } from './conveniences/keys.js';

import { addMenu } from './preferences/menu.js';
import { Panel } from './preferences/panel.js';
import { Overview } from './preferences/overview.js';
import { Dash } from './preferences/dash.js';
import { Applications } from './preferences/applications.js';
import { Overlays } from './preferences/overlays.js';
import { Other } from './preferences/other.js';


export default class BlurMyShellPreferences extends ExtensionPreferences {
    constructor(metadata) {
        super(metadata);

        // load the icon theme
        let iconPath = this.dir.get_child("icons").get_path();
        let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        iconTheme.add_search_path(iconPath);
    }

    fillPreferencesWindow(window) {
        addMenu(window);

        // update from old settings, very important for hacks level specifically
        update_from_old_settings(this.getSettings());

        const actionGroup = new Gio.SimpleActionGroup();
        window.insert_action_group('link', actionGroup);
        const action = new Gio.SimpleAction({ name: 'open-gnome-rounded-blur' });
        action.connect('activate', () => {
            Gio.AppInfo.launch_default_for_uri(
                'https://github.com/aunetx/blur-my-shell/blob/master/scripts/GUIDE.md',
                null
            );
        });
        actionGroup.add_action(action);

        const preferences = new Settings(KEYS, this.getSettings());
        window.add(new Panel(preferences));
        window.add(new Overview(preferences));
        window.add(new Dash(preferences));
        window.add(new Applications(preferences, window));
        window.add(new Overlays(preferences));
        window.add(new Other(preferences));

        window.search_enabled = true;
    }
}
