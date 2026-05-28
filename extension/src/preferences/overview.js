import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';


export const Overview = GObject.registerClass({
    GTypeName: 'BmsGlassOverview',
    Template: GLib.uri_resolve_relative(import.meta.url, '../ui/overview.ui', GLib.UriFlags.NONE),
    InternalChildren: [
        'overview_blur',
        'overview_sigma',
        'overview_brightness',
        'overview_vibrancy',
        'overview_opacity',
        'overview_style_components',

        'appfolder_blur',
        'appfolder_sigma',
        'appfolder_brightness',
        'appfolder_vibrancy',
        'appfolder_style_dialogs'
    ],
}, class Overview extends Adw.PreferencesPage {
    constructor(preferences) {
        super({});

        this.preferences = preferences;

        this.preferences.overview.settings.bind(
            'blur', this._overview_blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this.preferences.overview.settings.bind(
            'sigma', this._overview_sigma, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overview.settings.bind(
            'brightness', this._overview_brightness, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overview.settings.bind(
            'vibrancy', this._overview_vibrancy, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overview.settings.bind(
            'opacity', this._overview_opacity, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overview.settings.bind(
            'style-components', this._overview_style_components, 'selected',
            Gio.SettingsBindFlags.DEFAULT
        );

        this.preferences.appfolder.settings.bind(
            'blur', this._appfolder_blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.appfolder.settings.bind(
            'sigma', this._appfolder_sigma, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.appfolder.settings.bind(
            'brightness', this._appfolder_brightness, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.appfolder.settings.bind(
            'vibrancy', this._appfolder_vibrancy, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.appfolder.settings.bind(
            'style-dialogs', this._appfolder_style_dialogs, 'selected',
            Gio.SettingsBindFlags.DEFAULT
        );
    }
});
