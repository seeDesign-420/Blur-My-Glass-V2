const VIBRANCY_INTENSITY_SCALE = 2;

export class BlurEffectBinding {
    constructor(settings, effect_overrides = {}) {
        this.settings = settings;
        this.effect_overrides = effect_overrides;
        this.effect = null;
    }

    bind(effect) {
        this.effect = effect;
        this._connectSettings();
        this._applyResolvedValues();
    }

    unbind() {
        this._disconnectSettings();
        this.effect = null;
    }

    _connectSettings() {
        this._sigma_changed_id = this.settings.settings.connect(
            'changed::sigma', () => {
                if (!this.effect)
                    return;
                this.effect.unscaled_radius = this._resolveUnscaledRadius();
            }
        );
        this._brightness_changed_id = this.settings.settings.connect(
            'changed::brightness', () => {
                if (!this.effect)
                    return;
                this.effect.brightness = this._resolveBrightness();
            }
        );
        this._vibrancy_changed_id = this.settings.settings.connect(
            'changed::vibrancy', () => this._setVibrancy(this._resolveVibrancy())
        );

        if (this.settings.CORNER_RADIUS !== undefined) {
            this._corner_radius_changed_id = this.settings.settings.connect(
                'changed::corner-radius', () => {
                    if (!this.effect)
                        return;
                    this.effect.corner_radius = this._resolveCornerRadius();
                }
            );
        }

        if (this.settings.REFRACTION_STRENGTH !== undefined
            && !this.effect_overrides.manage_refraction_manually) {
            this._refraction_strength_changed_id = this.settings.settings.connect(
                'changed::refraction-strength',
                () => {
                    if (!this.effect)
                        return;
                    try {
                        this.effect.refraction_strength = this._resolveRefractionStrength();
                    } catch (e) {
                        this._warn(`refraction-strength update failed: ${e}`);
                    }
                }
            );
        }

        if (this.settings.REFRACTION_RADIUS !== undefined) {
            this._refraction_radius_changed_id = this.settings.settings.connect(
                'changed::refraction-radius',
                () => {
                    if (!this.effect)
                        return;
                    try {
                        this.effect.refraction_radius = this._resolveRefractionRadius();
                    } catch (e) {
                        this._warn(`refraction-radius update failed: ${e}`);
                    }
                }
            );
        }

        if (this.settings.REFRACTION_INNER_RADIUS !== undefined) {
            this._refraction_inner_radius_changed_id = this.settings.settings.connect(
                'changed::refraction-inner-radius',
                () => {
                    if (!this.effect)
                        return;
                    try {
                        this.effect.refraction_inner_radius = this._resolveRefractionInnerRadius();
                    } catch (e) {
                        this._warn(`refraction-inner-radius update failed: ${e}`);
                    }
                }
            );
        }
    }

    _disconnectSettings() {
        if (this._sigma_changed_id)
            this.settings.settings.disconnect(this._sigma_changed_id);
        if (this._brightness_changed_id)
            this.settings.settings.disconnect(this._brightness_changed_id);
        if (this._vibrancy_changed_id)
            this.settings.settings.disconnect(this._vibrancy_changed_id);
        if (this._corner_radius_changed_id)
            this.settings.settings.disconnect(this._corner_radius_changed_id);
        if (this._refraction_strength_changed_id)
            this.settings.settings.disconnect(this._refraction_strength_changed_id);
        if (this._refraction_radius_changed_id)
            this.settings.settings.disconnect(this._refraction_radius_changed_id);
        if (this._refraction_inner_radius_changed_id)
            this.settings.settings.disconnect(this._refraction_inner_radius_changed_id);

        delete this._sigma_changed_id;
        delete this._brightness_changed_id;
        delete this._vibrancy_changed_id;
        delete this._corner_radius_changed_id;
        delete this._refraction_strength_changed_id;
        delete this._refraction_radius_changed_id;
        delete this._refraction_inner_radius_changed_id;
    }

    _applyResolvedValues() {
        if (!this.effect)
            return;

        const resolved = this.getResolvedEffectParams();

        this.effect.unscaled_radius = resolved.unscaled_radius;
        this.effect.brightness = resolved.brightness;
        this._setVibrancy(resolved.vibrancy);
        if (this.settings.CORNER_RADIUS !== undefined)
            this.effect.corner_radius = resolved.corner_radius;
        if (this.settings.REFRACTION_STRENGTH !== undefined
            || this.settings.REFRACTION_RADIUS !== undefined
            || this.settings.REFRACTION_INNER_RADIUS !== undefined) {
            try {
                this.effect.refraction_strength = resolved.refraction_strength;
                this.effect.refraction_radius = resolved.refraction_radius;
                this.effect.refraction_inner_radius = resolved.refraction_inner_radius;
            } catch (e) {
                if ((resolved.refraction_strength ?? 0) > 0)
                    console.warn(`[Blur my Shell > effect]       Shell.BlurEffect does not expose liquid-glass refraction: ${e}`);
            }
        }
    }

    getResolvedEffectParams() {
        const params = {
            unscaled_radius: this._resolveUnscaledRadius(),
            brightness: this._resolveBrightness(),
            vibrancy: this._resolveVibrancy(),
        };

        if (this.settings.CORNER_RADIUS !== undefined)
            params.corner_radius = this._resolveCornerRadius();

        if (this.settings.REFRACTION_STRENGTH !== undefined)
            params.refraction_strength = this._resolveRefractionStrength();

        if (this.settings.REFRACTION_RADIUS !== undefined)
            params.refraction_radius = this._resolveRefractionRadius();

        if (this.settings.REFRACTION_INNER_RADIUS !== undefined)
            params.refraction_inner_radius = this._resolveRefractionInnerRadius();

        return params;
    }

    _resolveOverrideValue(name, fallback) {
        const fixed = this.effect_overrides[name];
        if (fixed !== undefined)
            return fixed;
        return fallback;
    }

    _resolveSigma() {
        const base = this.settings.SIGMA;
        const multiplier = this.effect_overrides.sigma_multiplier ?? 1;
        return Math.max(0, this._resolveOverrideValue('sigma', base * multiplier));
    }

    _resolveUnscaledRadius() {
        return 2 * this._resolveSigma();
    }

    _resolveBrightness() {
        const base = this.settings.BRIGHTNESS;
        const multiplier = this.effect_overrides.brightness_multiplier ?? 1;
        return Math.min(1, Math.max(0, this._resolveOverrideValue('brightness', base * multiplier)));
    }

    _resolveVibrancy() {
        const base = this.settings.VIBRANCY ?? 0;
        const multiplier = this.effect_overrides.vibrancy_multiplier ?? 1;
        const resolved = this._resolveOverrideValue('vibrancy', base * multiplier);
        return this._mapVibrancySetting(resolved);
    }

    _mapVibrancySetting(vibrancy) {
        return Math.min(VIBRANCY_INTENSITY_SCALE, Math.max(0, vibrancy * VIBRANCY_INTENSITY_SCALE));
    }

    _resolveCornerRadius() {
        const base = this.settings.CORNER_RADIUS;
        const multiplier = this.effect_overrides.corner_radius_multiplier ?? 1;
        const offset = this.effect_overrides.corner_radius_offset ?? 0;
        return Math.max(0, this._resolveOverrideValue('corner_radius', (base * multiplier) + offset));
    }

    _resolveRefractionStrength() {
        const base = this.settings.REFRACTION_STRENGTH ?? 0;
        const multiplier = this.effect_overrides.refraction_strength_multiplier ?? 1;
        const offset = this.effect_overrides.refraction_strength_offset ?? 0;
        return Math.max(0, this._resolveOverrideValue('refraction_strength', (base * multiplier) + offset));
    }

    _resolveRefractionRadius() {
        const base = this.settings.REFRACTION_RADIUS ?? 24;
        return this._resolveOverrideValue('refraction_radius', base);
    }

    _resolveRefractionInnerRadius() {
        const base = this.settings.REFRACTION_INNER_RADIUS ?? 24;
        return this._resolveOverrideValue('refraction_inner_radius', base);
    }

    _setVibrancy(vibrancy) {
        if (this.effect)
            this.effect.vibrancy = vibrancy;
    }

    _warn(str) {
        console.warn(`[Blur my Shell > effect bind]  ${str}`);
    }
}
