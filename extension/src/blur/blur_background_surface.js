import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';

export class BlurBackgroundSurface {
    constructor() {
        this._actor = null;
        this._actor_destroy_id = null;
        this._bg_manager = null;
    }

    attach(actor, onDestroy) {
        this.detach();
        this._actor = actor;
        if (this._actor)
            this._actor_destroy_id = this._actor.connect('destroy', () => onDestroy?.());
    }

    create(background_group, widget_name, onDestroy) {
        const actor = new St.Widget({
            name: widget_name,
            width: 1,
            height: 1,
            clip_to_allocation: true,
        });
        actor.set_clip(0, 0, 1, 1);

        this.attach(actor, onDestroy);

        this._bg_manager = new Clutter.Actor();
        this._bg_manager.backgroundActor = actor;
        this._bg_manager._bms_surface = this;

        background_group.insert_child_at_index(actor, 0);
        return [actor, this._bg_manager];
    }

    create_wallpaper(background_group, monitor_index, widget_name, onDestroy) {
        const monitor = Main.layoutManager.monitors[monitor_index];
        if (!monitor)
            return [null, null];

        const actor = new St.Widget({
            name: widget_name,
            x: monitor.x,
            y: monitor.y,
            z_position: 1,
            width: monitor.width,
            height: monitor.height,
            clip_to_allocation: true,
        });
        actor.set_clip(0, 0, monitor.width, monitor.height);

        this.attach(actor, onDestroy);

        this._bg_manager = new Background.BackgroundManager({
            container: actor,
            monitorIndex: monitor_index,
            controlPosition: false,
        });
        this._bg_manager._bms_surface = this;

        background_group.insert_child_at_index(actor, 0);
        return [actor, this._bg_manager];
    }

    add_effect(effect) {
        if (!this._actor)
            return false;

        this._actor.add_effect(effect);
        return true;
    }

    set_visible(visible) {
        if (this._actor)
            this._actor.visible = visible;
    }

    set_opacity(opacity) {
        if (this._actor)
            this._actor.opacity = opacity;
    }

    detach() {
        if (this._actor && this._actor_destroy_id) {
            try {
                this._actor.disconnect(this._actor_destroy_id);
            } catch {
                // Actor may already be destroyed.
            }
        }
        this._actor_destroy_id = null;
        this._actor = null;
        this._bg_manager = null;
    }
}
