import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';


export const Dash = GObject.registerClass({
    GTypeName: 'BmsGlassDash',
    Template: GLib.uri_resolve_relative(import.meta.url, '../ui/dash.ui', GLib.UriFlags.NONE),
    InternalChildren: [
        'blur',
        'blur_mode_row',
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
        'override_background',
        'style_dash_to_dock',
        'unblur_in_overview_row',
        'unblur_in_overview'
    ],
}, class Dash extends Adw.PreferencesPage {
    constructor(preferences, pipelines_manager, pipelines_page) {
        super({});

        this.preferences = preferences;
        this.pipelines_manager = pipelines_manager;
        this.pipelines_page = pipelines_page;

        this.preferences.dhruva.settings.bind(
            'blur', this._blur, 'active',
            Gio.SettingsBindFlags.DEFAULT
        );

        this._pipeline_choose_row.initialize(
            this.preferences.dhruva, this.pipelines_manager, this.pipelines_page
        );

        this.change_blur_mode(false, true);

        this._mode_static.connect('toggled',
            () => this._mode_dynamic.set_active(true)
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
    }

    change_blur_mode(is_static_blur, first_run) {
        this._mode_static.set_active(false);
        this._mode_dynamic.set_active(true);

        this._blur_mode_row.set_visible(false);
        this._pipeline_choose_row.set_visible(false);
        this._sigma_row.set_visible(true);
        this._brightness_row.set_visible(true);
        this._vibrancy_row.set_visible(true);
        this._refraction_strength_row.set_visible(true);
        this._refraction_radius_row.set_visible(this.preferences.ROUNDED_BLUR_FOUND);
        this._refraction_inner_radius_row.set_visible(this.preferences.ROUNDED_BLUR_FOUND);
        this._corner_radius_row.set_visible(this.preferences.ROUNDED_BLUR_FOUND);
        this._corner_radius_not_found_row.set_visible(!this.preferences.ROUNDED_BLUR_FOUND);
    }
});
