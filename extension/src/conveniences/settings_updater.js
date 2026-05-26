import { Settings } from './settings.js';
import { KEYS, DEPRECATED_KEYS } from './keys.js';

const CURRENT_SETTINGS_VERSION = 7;

export function update_from_old_settings(gsettings) {
    const preferences = new Settings(KEYS, gsettings);
    const deprecated_preferences = new Settings(DEPRECATED_KEYS, gsettings);
    const old_version = preferences.settings.get_int('settings-version');

    if (old_version < 2) {
        // set artifacts hacks to be 1 at most, as it should be suitable now that most big bugs have
        // been resolved (and especially because hack levels to 2 now means disabling clipped
        // redraws entirely, which is very much not what we want for users that update)
        if (preferences.HACKS_LEVEL > 1)
            preferences.HACKS_LEVEL = 1;

        preferences.dhruva.BLUR = true;

        // 'customize' has been removed: we merge the current used settings
        ['appfolder', 'panel', 'dhruva', 'applications'].forEach(
            component_name => {
                const deprecated_component = deprecated_preferences[component_name];
                const new_component = preferences[component_name];
                if (deprecated_component && !deprecated_component.CUSTOMIZE) {
                    new_component.SIGMA = deprecated_preferences.SIGMA;
                    new_component.BRIGHTNESS = deprecated_preferences.BRIGHTNESS;
                    if (
                        new_component.CORNER_RADIUS !== undefined &&
                        deprecated_component.CORNER_RADIUS !== undefined
                    )
                        new_component.CORNER_RADIUS = deprecated_component.CORNER_RADIUS;
                }
            });

        // remove old preferences in order not to clutter the gsettings
        deprecated_preferences.reset();
    }

    if (old_version < 3) {
        // Keep Dhruva on the same liquid-glass material as application blur.
        // The dock has its own actor geometry, but the optical parameters
        // should not diverge from the application material on upgrade.
        preferences.dhruva.SIGMA = preferences.applications.SIGMA;
        preferences.dhruva.BRIGHTNESS = preferences.applications.BRIGHTNESS;
        preferences.dhruva.REFRACTION_STRENGTH = preferences.applications.REFRACTION_STRENGTH;
    }

    if (old_version < 4) {
        preferences.dhruva.REFRACTION_RADIUS = 24;
        preferences.applications.REFRACTION_RADIUS = 24;
    }

    if (old_version < 5) {
        preferences.dhruva.REFRACTION_INNER_RADIUS = 24;
        preferences.applications.REFRACTION_INNER_RADIUS = 24;
    }

    preferences.settings.set_int('settings-version', CURRENT_SETTINGS_VERSION);
}
