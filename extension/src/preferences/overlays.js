import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';


export const Overlays = GObject.registerClass({
    GTypeName: 'BmsGlassOverlays',
    Template: GLib.uri_resolve_relative(import.meta.url, '../ui/overlays.ui', GLib.UriFlags.NONE),
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
        'date_menu',
        'quick_settings',
        'notifications',
        'osd',
        'desktop_menus',
        'app_menus',
    ],
}, class Overlays extends Adw.PreferencesPage {
    constructor(preferences) {
        super({});

        this.preferences = preferences;

        this.preferences.overlays.settings.bind(
            'blur', this._blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this.preferences.overlays.settings.bind(
            'sigma', this._sigma, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overlays.settings.bind(
            'brightness', this._brightness, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overlays.settings.bind(
            'vibrancy', this._vibrancy, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overlays.settings.bind(
            'corner-radius', this._corner_radius, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overlays.settings.bind(
            'refraction-strength', this._refraction_strength, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overlays.settings.bind(
            'refraction-radius', this._refraction_radius, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overlays.settings.bind(
            'refraction-inner-radius', this._refraction_inner_radius, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        this.preferences.overlays.settings.bind(
            'date-menu', this._date_menu, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overlays.settings.bind(
            'quick-settings', this._quick_settings, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overlays.settings.bind(
            'notifications', this._notifications, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overlays.settings.bind(
            'osd', this._osd, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overlays.settings.bind(
            'desktop-menus', this._desktop_menus, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this.preferences.overlays.settings.bind(
            'app-menus', this._app_menus, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        this._corner_radius_row.set_visible(this.preferences.ROUNDED_BLUR_FOUND);
        this._corner_radius_not_found_row.set_visible(!this.preferences.ROUNDED_BLUR_FOUND);
        this._refraction_radius_row.set_visible(this.preferences.ROUNDED_BLUR_FOUND);
        this._refraction_inner_radius_row.set_visible(this.preferences.ROUNDED_BLUR_FOUND);
    }
});
