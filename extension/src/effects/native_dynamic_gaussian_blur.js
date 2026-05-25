import GObject from 'gi://GObject';

import * as utils from '../conveniences/utils.js';
const St = await utils.import_in_shell_only('gi://St');
const Shell = await utils.import_in_shell_only('gi://Shell');


const DEFAULT_PARAMS = {
    unscaled_radius: 30, brightness: 0.6, vibrancy: 0.0, corner_radius: 14
};


export const NativeDynamicBlurEffect = utils.IS_IN_PREFERENCES ?
    { default_params: DEFAULT_PARAMS } :
    new GObject.registerClass({
        GTypeName: "NativeDynamicBlurEffect"
    }, class NativeDynamicBlurEffect extends Shell.BlurEffect {
        constructor(params) {
            const { unscaled_radius, brightness, vibrancy, corner_radius, refraction_strength, refraction_radius, refraction_inner_radius, ...parent_params } = params;
            super({ ...parent_params, mode: Shell.BlurMode.BACKGROUND });

            this._theme_context = St.ThemeContext.get_for_stage(global.stage);
            this._theme_context.connectObject(
                'notify::scale-factor',
                _ => {
                    this.radius = this.unscaled_radius * this._theme_context.scale_factor;
                    this.corner_radius = this.unscaled_corner_radius * this._theme_context.scale_factor;
                },
                this
            );

            utils.setup_params(this, params);
            try {
                this.refraction_strength = refraction_strength ?? 0;
                this.refraction_radius = refraction_radius ?? 24;
                this.refraction_inner_radius = refraction_inner_radius ?? 24;
            } catch (e) {
                if ((refraction_strength ?? 0) > 0)
                    console.warn(`[Blur my Shell > effect]       Shell.BlurEffect does not expose liquid-glass refraction: ${e}`);
            }
        }

        static get default_params() {
            return DEFAULT_PARAMS;
        }

        get unscaled_radius() {
            return this._unscaled_radius;
        }

        set unscaled_radius(value) {
            this._unscaled_radius = value;
            this.radius = value * this._theme_context.scale_factor;
        }

        get unscaled_corner_radius() {
            return this._unscaled_corner_radius;
        }

        set unscaled_corner_radius(value) {
            this._unscaled_corner_radius = value;
            this.corner_radius = value * this._theme_context.scale_factor;
        }

    });
