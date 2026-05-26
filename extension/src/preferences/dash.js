import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';


export const Dash = GObject.registerClass({
    GTypeName: 'BmsGlassDash',
    Template: GLib.uri_resolve_relative(import.meta.url, '../ui/dash.ui', GLib.UriFlags.NONE),
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
        'refraction_strength_row',
        'refraction_strength',
        'refraction_radius_row',
        'refraction_radius',
        'refraction_inner_radius_row',
        'refraction_inner_radius',
        'override_background',
        'style_dash_to_dock',
        'unblur_in_overview_row',
        'unblur_in_overview'
    ],
}, class Dash extends Adw.PreferencesPage {
    constructor(preferences) {
        super({});

        this.preferences = preferences;

        this.preferences.dhruva.settings.bind(
            'blur', this._blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this.preferences.dhruva.settings.bind(
            'sigma', this._sigma, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.dhruva.settings.bind(
            'brightness', this._brightness, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.dhruva.settings.bind(
            'vibrancy', this._vibrancy, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.dhruva.settings.bind(
            'corner-radius', this._corner_radius, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.dhruva.settings.bind(
            'refraction-strength', this._refraction_strength, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.dhruva.settings.bind(
            'refraction-radius', this._refraction_radius, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.dhruva.settings.bind(
            'refraction-inner-radius', this._refraction_inner_radius, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._override_background.set_visible(false);
        this._unblur_in_overview_row.set_visible(false);
        this._refraction_radius_row.set_visible(this.preferences.ROUNDED_BLUR_FOUND);
        this._refraction_inner_radius_row.set_visible(this.preferences.ROUNDED_BLUR_FOUND);
        this._corner_radius_row.set_visible(this.preferences.ROUNDED_BLUR_FOUND);
        this._corner_radius_not_found_row.set_visible(!this.preferences.ROUNDED_BLUR_FOUND);
    }
});
