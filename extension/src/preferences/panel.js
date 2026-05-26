import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';


export const Panel = GObject.registerClass({
    GTypeName: 'BmsGlassPanel',
    Template: GLib.uri_resolve_relative(import.meta.url, '../ui/panel.ui', GLib.UriFlags.NONE),
    InternalChildren: [
        'blur',
        'sigma_row',
        'sigma',
        'brightness_row',
        'brightness',
        'vibrancy_row',
        'vibrancy',
        'corner_radius_not_found_row',
        'corner_radius_row',
        'corner_radius',
        'unblur_in_overview',
        'force_light_text',
        'override_background',
        'style_panel',
        'override_background_dynamically',
        'hidetopbar_compatibility',
        'dtp_blur_original_panel'
    ],
}, class Panel extends Adw.PreferencesPage {
    constructor(preferences) {
        super({});

        this.preferences = preferences;

        this.preferences.panel.settings.bind(
            'blur', this._blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this.preferences.panel.settings.bind(
            'sigma', this._sigma, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.panel.settings.bind(
            'brightness', this._brightness, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.panel.settings.bind(
            'vibrancy', this._vibrancy, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.panel.settings.bind(
            'corner-radius', this._corner_radius, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.panel.settings.bind(
            'unblur-in-overview', this._unblur_in_overview, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.panel.settings.bind(
            'force-light-text', this._force_light_text, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.panel.settings.bind(
            'override-background',
            this._override_background, 'enable-expansion',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.panel.settings.bind(
            'style-panel', this._style_panel, 'selected',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.panel.settings.bind(
            'override-background-dynamically',
            this._override_background_dynamically, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.hidetopbar.settings.bind(
            'compatibility', this._hidetopbar_compatibility, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.dash_to_panel.settings.bind(
            'blur-original-panel', this._dtp_blur_original_panel, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this._corner_radius_row.set_visible(this.preferences.ROUNDED_BLUR_FOUND);
        this._corner_radius_not_found_row.set_visible(!this.preferences.ROUNDED_BLUR_FOUND);
    }
});
