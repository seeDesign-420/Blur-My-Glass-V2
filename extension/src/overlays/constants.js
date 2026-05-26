export const GEOMETRY_SIGNALS = [
    'notify::allocation',
    'notify::x',
    'notify::y',
    'notify::width',
    'notify::height',
    'notify::scale-x',
    'notify::scale-y',
    'notify::translation-x',
    'notify::translation-y',
    'notify::pivot-point',
];

const TARGET_TUNING = Object.freeze({
    'date-menu': Object.freeze({
        sigma_multiplier: 1.0,
        brightness_multiplier: 1.0,
        vibrancy_multiplier: 1.0,
        corner_radius_multiplier: 1.0,
    }),
    'quick-settings': Object.freeze({
        sigma_multiplier: 0.95,
        brightness_multiplier: 0.95,
        vibrancy_multiplier: 0.95,
        corner_radius_multiplier: 1.0,
    }),
    'notifications': Object.freeze({
        sigma_multiplier: 0.9,
        brightness_multiplier: 0.88,
        vibrancy_multiplier: 0.82,
        corner_radius_offset: -4,
        refraction_strength_multiplier: 0.95,
    }),
    osd: Object.freeze({
        sigma_multiplier: 0.85,
        brightness_multiplier: 0.9,
        vibrancy_multiplier: 0.85,
        corner_radius_offset: -2,
        refraction_strength_multiplier: 0.9,
    }),
    'desktop-menus': Object.freeze({
        sigma_multiplier: 0.9,
        brightness_multiplier: 0.92,
        vibrancy_multiplier: 0.9,
        corner_radius_offset: -6,
    }),
    'app-menus': Object.freeze({
        sigma_multiplier: 0.9,
        brightness_multiplier: 0.92,
        vibrancy_multiplier: 0.9,
        corner_radius_offset: -6,
    }),
    'panel-menus': Object.freeze({
        sigma_multiplier: 0.92,
        brightness_multiplier: 0.94,
        vibrancy_multiplier: 0.92,
        corner_radius_offset: -2,
    }),
});

export const OPEN_ANIMATION_DURATION_MS = 180;
export const CLOSE_ANIMATION_DURATION_MS = 220;

export function getOverlayTuning(name) {
    return TARGET_TUNING[name] ?? {};
}
