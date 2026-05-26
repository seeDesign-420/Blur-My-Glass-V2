import { BlurEffectBinding } from './blur_effect_binding.js';
import { BlurBackgroundSurface } from './blur_background_surface.js';

export class DynamicBlurPipeline {
    constructor(effects_manager, settings, actor = null, effect_overrides = {}) {
        this.effects_manager = effects_manager;
        this.settings = settings;
        this.effect_overrides = effect_overrides;
        this.effect = null;
        this._binding = new BlurEffectBinding(settings, effect_overrides);
        this._surface = new BlurBackgroundSurface();
        this.attach_effect_to_actor(actor);
    }

    create_background_with_effect(background_group, widget_name) {
        const [actor, bg_manager] = this._surface.create(
            background_group,
            widget_name,
            () => this.remove_pipeline_from_actor()
        );

        this.attach_effect_to_actor(actor);
        bg_manager._bms_pipeline = this;
        return [actor, bg_manager];
    }

    attach_effect_to_actor(actor) {
        if (!actor) {
            this.remove_pipeline_from_actor();
            return;
        }

        this._surface.attach(actor, () => this.remove_pipeline_from_actor());
        this._create_effect();

        if (this._surface.actor)
            this._surface.actor.add_effect(this.effect);
        else
            this._warn('could not add effect to actor, actor does not exist anymore');
    }

    _create_effect() {
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

        this.remove_effect();
        this.effect = this.effects_manager.new_native_dynamic_gaussian_blur_effect(params);
        this._binding.bind(this.effect);
    }

    remove_pipeline_from_actor() {
        this.remove_effect();
        this._surface.detach();
    }

    repaint_effect() {
        this.effect?.queue_repaint();
    }

    remove_effect() {
        this._binding.unbind();
        if (this.effect)
            this.effects_manager.remove(this.effect);
        this.effect = null;
    }

    change_pipeline_to() { return; }

    destroy() {
        this.remove_effect();
        this.remove_pipeline_from_actor();
    }

    _warn(str) {
        console.warn(`[Blur my Shell > dynamic pip]  ${str}`);
    }
}
