import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';


export const Other = GObject.registerClass({
    GTypeName: 'BmsGlassOther',
    Template: GLib.uri_resolve_relative(import.meta.url, '../ui/other.ui', GLib.UriFlags.NONE),
    InternalChildren: [
        'lockscreen_blur',
        'lockscreen_sigma',
        'lockscreen_brightness',
        'lockscreen_vibrancy',

        'hack_level',
        'debug',
        'reset'
    ],
}, class Other extends Adw.PreferencesPage {
    constructor(preferences) {
        super({});

        this.preferences = preferences;

        this.preferences.lockscreen.settings.bind(
            'blur', this._lockscreen_blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.lockscreen.settings.bind(
            'sigma', this._lockscreen_sigma, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.lockscreen.settings.bind(
            'brightness', this._lockscreen_brightness, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.lockscreen.settings.bind(
            'vibrancy', this._lockscreen_vibrancy, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this.preferences.settings.bind(
            'hacks-level', this._hack_level, 'selected',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.settings.bind(
            'debug', this._debug, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._reset.connect('clicked', () => this.preferences.reset());
    }
});
