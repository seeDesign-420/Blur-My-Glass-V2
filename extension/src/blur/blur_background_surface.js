import St from 'gi://St';
import Clutter from 'gi://Clutter';

export class BlurBackgroundSurface {
    constructor() {
        this.actor = null;
        this.actor_destroy_id = null;
        this._bg_manager = null;
    }

    attach(actor, onDestroy) {
        this.detach();
        this.actor = actor;
        if (this.actor)
            this.actor_destroy_id = this.actor.connect('destroy', () => onDestroy?.());
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

    detach() {
        if (this.actor && this.actor_destroy_id) {
            try {
                this.actor.disconnect(this.actor_destroy_id);
            } catch {
                // Actor may already be destroyed.
            }
        }
        this.actor_destroy_id = null;
        this.actor = null;
        this._bg_manager = null;
    }
}
