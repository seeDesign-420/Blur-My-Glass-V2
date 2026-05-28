import { BlurEffectBinding } from './blur_effect_binding.js';
import { BlurBackgroundSurface } from './blur_background_surface.js';

export class DynamicBlurPipeline {
    constructor(effects_manager, settings, actor = null, effect_overrides = {}) {
        this.effects_manager = effects_manager;
        this.settings = settings;
        this.effect_overrides = effect_overrides;
        this.effect_type = effect_overrides.effect_type ?? 'native_dynamic_gaussian_blur';
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

    create_wallpaper_background_with_effect(background_group, monitor_index, widget_name) {
        const [actor, bg_manager] = this._surface.create_wallpaper(
            background_group,
            monitor_index,
            widget_name,
            () => this.remove_pipeline_from_actor()
        );

        if (!actor || !bg_manager)
            return [actor, bg_manager];

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

        if (!this.effect || !this._surface.add_effect(this.effect))
            this._warn('could not add effect to actor, actor does not exist anymore');
    }

    _create_effect() {
        const params = this._binding.getResolvedEffectParams();

        this.remove_effect();
        const factory = this.effects_manager[`new_${this.effect_type}_effect`];
        if (!factory) {
            this._warn(`could not create effect, effect "${this.effect_type}" not found`);
            return;
        }

        this.effect = factory.call(this.effects_manager, params);
        this._binding.bind(this.effect);
    }

    remove_pipeline_from_actor() {
        this.remove_effect();
        this._surface.detach();
    }

    repaint_effect() {
        this.effect?.queue_repaint();
    }

    set_visible(visible) {
        this._surface.set_visible(visible);
    }

    set_opacity(opacity) {
        this._surface.set_opacity(opacity);
    }

    reapply_settings() {
        this._binding.reapply();
        this.repaint_effect();
    }

    remove_effect() {
        this._binding.unbind();
        if (this.effect)
            this.effects_manager.remove(this.effect);
        this.effect = null;
    }

    destroy() {
        this.remove_effect();
        this.remove_pipeline_from_actor();
    }

    _warn(str) {
        console.warn(`[Blur my Shell > dynamic pip]  ${str}`);
    }
}
