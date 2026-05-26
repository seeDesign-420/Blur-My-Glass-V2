import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { UnlockDialog } from 'resource:///org/gnome/shell/ui/unlockDialog.js';

import { DynamicBlurPipeline } from '../blur/dynamic_blur_pipeline.js';

const original_createBackground =
    UnlockDialog.prototype._createBackground;
const original_updateBackgroundEffects =
    UnlockDialog.prototype._updateBackgroundEffects;
const original_updateBackgrounds =
    UnlockDialog.prototype._updateBackgrounds;


export const LockscreenBlur = class LockscreenBlur {
    constructor(connections, settings, effects_manager) {
        this.connections = connections;
        this.settings = settings;
        this.effects_manager = effects_manager;
        this.enabled = false;
    }

    enable() {
        this._log("blurring lockscreen");

        this.update_lockscreen();

        this.enabled = true;
    }

    update_lockscreen() {
        UnlockDialog.prototype._createBackground =
            this._createBackground;
        UnlockDialog.prototype._updateBackgroundEffects =
            this._updateBackgroundEffects;
        UnlockDialog.prototype._updateBackgrounds =
            this._updateBackgrounds;
    }

    _createBackground(monitor_index) {
        const monitor = Main.layoutManager.monitors[monitor_index];
        if (!monitor)
            return;

        const pipeline = new DynamicBlurPipeline(
            global.blur_my_shell._effects_manager,
            global.blur_my_shell._settings.lockscreen
        );
        const [background, bg_manager] = pipeline.create_background_with_effect(
            this._backgroundGroup,
            'screen-shield-background'
        );
        background.x = monitor.x;
        background.y = monitor.y;
        background.width = monitor.width;
        background.height = monitor.height;
        background.set_clip(0, 0, monitor.width, monitor.height);
        bg_manager._monitorIndex = monitor_index;
        this._bgManagers.push(bg_manager);
    }

    _updateBackgroundEffects() {
        this._updateBackgrounds();
    }

    _updateBackgrounds() {
        for (let i = 0; i < this._bgManagers.length; i++) {
            this._bgManagers[i]._bms_pipeline.destroy();
            this._bgManagers[i].destroy();
        }

        this._bgManagers = [];
        this._backgroundGroup.destroy_all_children();

        for (let i = 0; i < Main.layoutManager.monitors.length; i++)
            this._createBackground(i);
    }

    disable() {
        this._log("removing blur from lockscreen");

        UnlockDialog.prototype._createBackground =
            original_createBackground;
        UnlockDialog.prototype._updateBackgroundEffects =
            original_updateBackgroundEffects;
        UnlockDialog.prototype._updateBackgrounds =
            original_updateBackgrounds;

        this.connections.disconnect_all();

        this.enabled = false;
    }

    _log(str) {
        if (this.settings.DEBUG)
            console.log(`[Blur my Shell > lockscreen]   ${str}`);
    }
};
