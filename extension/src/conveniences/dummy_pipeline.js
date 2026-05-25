import St from 'gi://St';
import Clutter from 'gi://Clutter';

/// A dummy `Pipeline`, for dynamic blur only.
/// Instead of a pipeline id, we take the settings of the component we want to blur.
export const DummyPipeline = class DummyPipeline {
    constructor(effects_manager, settings, actor = null, effect_overrides = {}) {
        this.effects_manager = effects_manager;
        this.settings = settings;
        this.effect_overrides = effect_overrides;
        this.effect = null;
        this.vibrancy_effect = null;
        this.attach_effect_to_actor(actor);
    }

    create_background_with_effect(
        background_group,
        widget_name
    ) {
        // create the new actor
        this.actor = new St.Widget({
            name: widget_name,
            width: 1,
            height: 1,
            clip_to_allocation: true,
        });
        this.actor.set_clip(0, 0, 1, 1);

        this.attach_effect_to_actor(this.actor);

        // a dummy `BackgroundManager`, just to access the pipeline easily
        let bg_manager = new Clutter.Actor;
        bg_manager.backgroundActor = this.actor;
        bg_manager._bms_pipeline = this;

        background_group.insert_child_at_index(this.actor, 0);

        return [this.actor, bg_manager];
    };

    attach_effect_to_actor(actor) {
        // set the actor
        if (actor)
            this.actor = actor;
        else {
            this.remove_pipeline_from_actor();
            return;
        }

        // build the new effect to be added
        const params = {
            unscaled_radius: 2 * this.settings.SIGMA,
            brightness: this.settings.BRIGHTNESS,
            vibrancy: this.settings.VIBRANCY ?? 0,
            refraction_strength: this.effect_overrides.refraction_strength ?? this.settings.REFRACTION_STRENGTH ?? 0,
            refraction_radius: this.settings.REFRACTION_RADIUS ?? 24,
            refraction_inner_radius: this.settings.REFRACTION_INNER_RADIUS ?? 24,
        };
        if (this.settings.CORNER_RADIUS !== undefined)
            params.corner_radius = this.settings.CORNER_RADIUS;

        this.build_effect(params);

        this.actor_destroy_id = this.actor.connect(
            "destroy", () => this.remove_pipeline_from_actor()
        );

        // add the effect to the actor
        if (this.actor) {
            this.actor.add_effect(this.effect);
            this.actor.add_effect(this.vibrancy_effect);
        } else
            this._warn(`could not add effect to actor, actor does not exist anymore`);
    }

    remove_pipeline_from_actor() {
        this.remove_effect();
        if (this.actor && this.actor_destroy_id)
            this.actor.disconnect(this.actor_destroy_id);
        this.actor_destroy_id = null;
        this.actor = null;
    }

    build_effect(params) {
        const resolved_sigma = this._resolveSigma();
        const resolved_brightness = this._resolveBrightness();
        const resolved_vibrancy = this._resolveVibrancy();
        const resolved_corner_radius = this.settings.CORNER_RADIUS !== undefined ?
            this._resolveCornerRadius() :
            0;
        const resolved_refraction_strength = this.settings.REFRACTION_STRENGTH !== undefined ?
            this._resolveRefractionStrength() :
            0;
        const resolved_refraction_radius = this.settings.REFRACTION_RADIUS !== undefined ?
            this._resolveRefractionRadius() :
            24;
        const resolved_refraction_inner_radius = this.settings.REFRACTION_INNER_RADIUS !== undefined ?
            this._resolveRefractionInnerRadius() :
            24;

        // create the effect
        this.effect = this.effects_manager.new_native_dynamic_gaussian_blur_effect(params);
        this.vibrancy_effect = this.effects_manager.new_luminosity_effect({
            saturation_multiplicator: 1 + resolved_vibrancy,
        });

        // connect to settings changes, using the true gsettings object
        this._sigma_changed_id = this.settings.settings.connect(
            'changed::sigma', () => this.effect.unscaled_radius = 2 * this._resolveSigma()
        );
        this._brightness_changed_id = this.settings.settings.connect(
            'changed::brightness', () => this.effect.brightness = this._resolveBrightness()
        );
        this._vibrancy_changed_id = this.settings.settings.connect(
            'changed::vibrancy', () => this._setVibrancy(this._resolveVibrancy())
        );
        if (this.settings.CORNER_RADIUS !== undefined) {
            this._corner_radius_changed_id = this.settings.settings.connect(
                'changed::corner-radius', () => this.effect.corner_radius = this._resolveCornerRadius()
            );
        }
        if (this.settings.REFRACTION_STRENGTH !== undefined
            && !this.effect_overrides.manage_refraction_manually) {
            this._refraction_strength_changed_id = this.settings.settings.connect(
                'changed::refraction-strength',
                () => {
                    try {
                        this.effect.refraction_strength = this._resolveRefractionStrength();
                    } catch (e) {
                    }
                }
            );
        }
        if (this.settings.REFRACTION_RADIUS !== undefined) {
            this._refraction_radius_changed_id = this.settings.settings.connect(
                'changed::refraction-radius',
                () => {
                    try {
                        this.effect.refraction_radius = this._resolveRefractionRadius();
                    } catch (e) {
                    }
                }
            );
        }
        if (this.settings.REFRACTION_INNER_RADIUS !== undefined) {
            this._refraction_inner_radius_changed_id = this.settings.settings.connect(
                'changed::refraction-inner-radius',
                () => {
                    try {
                        this.effect.refraction_inner_radius = this._resolveRefractionInnerRadius();
                    } catch (e) {
                    }
                }
            );
        }

        this.effect.unscaled_radius = resolved_sigma;
        this.effect.brightness = resolved_brightness;
        this._setVibrancy(resolved_vibrancy);
        if (this.settings.CORNER_RADIUS !== undefined)
            this.effect.corner_radius = resolved_corner_radius;
        if (this.settings.REFRACTION_STRENGTH !== undefined
            || this.settings.REFRACTION_RADIUS !== undefined
            || this.settings.REFRACTION_INNER_RADIUS !== undefined) {
            try {
                this.effect.refraction_strength = resolved_refraction_strength;
                this.effect.refraction_radius = resolved_refraction_radius;
                this.effect.refraction_inner_radius = resolved_refraction_inner_radius;
            } catch (e) {
                if ((resolved_refraction_strength ?? 0) > 0)
                    console.warn(`[Blur my Shell > effect]       Shell.BlurEffect does not expose liquid-glass refraction: ${e}`);
            }
        }
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

    _resolveBrightness() {
        const base = this.settings.BRIGHTNESS;
        const multiplier = this.effect_overrides.brightness_multiplier ?? 1;
        return Math.min(1, Math.max(0, this._resolveOverrideValue('brightness', base * multiplier)));
    }

    _resolveVibrancy() {
        const base = this.settings.VIBRANCY ?? 0;
        const multiplier = this.effect_overrides.vibrancy_multiplier ?? 1;
        return Math.min(1, Math.max(0, this._resolveOverrideValue('vibrancy', base * multiplier)));
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

    repaint_effect() {
        this.effect?.queue_repaint();
        this.vibrancy_effect?.queue_repaint();
    }

    _setVibrancy(vibrancy) {
        if (this.effect)
            this.effect.vibrancy = vibrancy;
        if (this.vibrancy_effect)
            this.vibrancy_effect.saturation_multiplicator = 1 + vibrancy;
    }

    /// Remove every effect from the actor it is attached to. Please note that they are not
    /// destroyed, but rather stored (thanks to the `EffectManager` class) to be reused later.
    remove_effect() {
        if (this.effect)
            this.effects_manager.remove(this.effect);
        if (this.vibrancy_effect)
            this.effects_manager.remove(this.vibrancy_effect);
        this.effect = null;
        this.vibrancy_effect = null;

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

    /// Do nothing for this dummy pipeline.
    /// Note: exposed to public API.
    change_pipeline_to() { return; }

    /// Note: exposed to public API.
    destroy() {
        this.remove_effect();
        this.remove_pipeline_from_actor();
    }

    _warn(str) {
        console.warn(`[Blur my Shell > dummy pip]    ${str}`);
    }
};
