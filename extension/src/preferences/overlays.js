import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';


export const Overlays = GObject.registerClass({
    GTypeName: 'BmsGlassOverlays',
    Template: GLib.uri_resolve_relative(import.meta.url, '../ui/overlays.ui', GLib.UriFlags.NONE),
    InternalChildren: [
        'blur',
        'pipeline_choose_row',
        'mode_static',
        'mode_dynamic',
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
    constructor(preferences, pipelines_manager, pipelines_page) {
        super({});

        this.preferences = preferences;
        this.pipelines_manager = pipelines_manager;
        this.pipelines_page = pipelines_page;

        this.preferences.overlays.settings.bind(
            'blur', this._blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._pipeline_choose_row.initialize(
            this.preferences.overlays, this.pipelines_manager, this.pipelines_page
        );

        this.change_blur_mode(this.preferences.overlays.STATIC_BLUR, true);

        this._mode_static.connect('toggled',
            () => this.preferences.overlays.STATIC_BLUR = this._mode_static.active
        );
        this.preferences.overlays.STATIC_BLUR_changed(
            () => this.change_blur_mode(this.preferences.overlays.STATIC_BLUR, false)
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
    }

    change_blur_mode(is_static_blur, first_run) {
        this._mode_static.set_active(is_static_blur);
        if (first_run)
            this._mode_dynamic.set_active(!is_static_blur);

        this._pipeline_choose_row.set_visible(is_static_blur);
        this._sigma_row.set_visible(!is_static_blur);
        this._brightness_row.set_visible(!is_static_blur);
        this._vibrancy_row.set_visible(!is_static_blur);
        this._corner_radius_row.set_visible(!is_static_blur && this.preferences.ROUNDED_BLUR_FOUND);
        this._corner_radius_not_found_row.set_visible(!is_static_blur && !this.preferences.ROUNDED_BLUR_FOUND);
        this._refraction_strength_row.set_visible(!is_static_blur);
        this._refraction_radius_row.set_visible(!is_static_blur && this.preferences.ROUNDED_BLUR_FOUND);
        this._refraction_inner_radius_row.set_visible(!is_static_blur && this.preferences.ROUNDED_BLUR_FOUND);
    }
});
