import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { Connections } from '../conveniences/connections.js';
import { DummyPipeline } from '../conveniences/dummy_pipeline.js';

export const DhruvaBlur = class DhruvaBlur {
    constructor(connections, settings, effects_manager) {
        this.connections = connections ?? new Connections();
        this.settings = settings;
        this.effects_manager = effects_manager;
        this.enabled = false;
        this._blurred_docks = new Map();
        this._blurred_menus = new Map();
        this._scan_timer_ids = [];
    }

    enable() {
        if (this.enabled)
            return;

        this.connections.connect(Main.uiGroup, 'child-added',
            (_, actor) => this._scan_actor_tree(actor));

        this.connections.connect(global.stage, 'child-added',
            (_, actor) => this._scan_actor_tree(actor));

        this._scan_for_docks();
        this._scan_for_menus();

        for (let delay of [500, 2000, 5000, 10000]) {
            let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                this._scan_timer_ids = this._scan_timer_ids.filter(t => t !== id);
                this._scan_for_docks();
                this._scan_for_menus();
                return GLib.SOURCE_REMOVE;
            });
            this._scan_timer_ids.push(id);
        }

        this.enabled = true;
    }

    disable() {
        for (let [container, state] of this._blurred_docks) {
            this._unblur_dock(container, state);
        }
        this._blurred_docks.clear();

        for (let [overlay, state] of this._blurred_menus)
            this._unblur_context_menu(overlay, state);
        this._blurred_menus.clear();

        for (let id of this._scan_timer_ids)
            GLib.source_remove(id);
        this._scan_timer_ids = [];

        this.connections.disconnect_all();
        this.enabled = false;
    }

    _scan_actor_tree(actor) {
        this._try_blur_dock_actor(actor);
        this._try_blur_menu_actor(actor);

        this._walk_actor_tree(actor, child => {
            this._try_blur_dock_actor(child);
            this._try_blur_menu_actor(child);
        });
    }

    _scan_for_docks() {
        for (let parent of [Main.uiGroup, global.stage]) {
            this._scan_actor_tree(parent);
        }
    }

    _scan_for_menus() {
        for (let parent of [Main.uiGroup, global.stage]) {
            this._scan_actor_tree(parent);
        }
    }

    _walk_actor_tree(actor, callback) {
        let stack = actor?.get_children?.() ?? [];

        while (stack.length > 0) {
            let child = stack.pop();
            callback(child);

            let children = child?.get_children?.();
            if (children?.length)
                stack.push(...children);
        }
    }

    _try_blur_dock_actor(actor) {
        let container = this._find_dhruva_container(actor);
        if (container && !this._blurred_docks.has(container))
            this._blur_dock(container);
    }

    _try_blur_menu_actor(actor) {
        if (this._is_dhruva_menu_overlay(actor) && !this._blurred_menus.has(actor))
            this._blur_context_menu(actor);
    }

    _find_dhruva_container(actor) {
        if (!actor)
            return null;

        if (actor.get_name?.() === 'DhruvaContainer')
            return actor;

        if (actor.get_name?.() === 'DhruvaBackground')
            return actor.get_parent?.() ?? null;

        let background = null;
        this._walk_actor_tree(actor, child => {
            if (!background && child.get_name?.() === 'DhruvaBackground')
                background = child;
        });

        return background?.get_parent?.() ?? null;
    }

    _is_dhruva_menu_overlay(actor) {
        let styleClass = actor.get_style_class_name?.() ?? '';
        return styleClass.includes('context-menu-overlay');
    }

    _blur_dock(container) {
        let parent = container.get_parent();
        if (!parent)
            return;

        let bgActor = this._find_background_actor(container);
        if (!bgActor)
            return;

        let background_group = new Meta.BackgroundGroup({
            name: 'bms-dhruva-bg-group',
            width: 0,
            height: 0,
        });

        const pipeline = new DummyPipeline(this.effects_manager, this.settings.dhruva);
        let [blurWidget, bgManager] = pipeline.create_background_with_effect(
            background_group, 'bms-dhruva-blurred-widget'
        );

        parent.insert_child_below(background_group, container);

        const sync_geometry = () => {
            try {
                let [abs_x, abs_y] = bgActor.get_transformed_position();
                let [ok, local_x, local_y] = parent.transform_stage_point(abs_x, abs_y);
                if (!ok)
                    return;
                let [tw, th] = bgActor.get_transformed_size();
                if (tw <= 0 || th <= 0)
                    return;

                background_group.set_position(Math.round(local_x), Math.round(local_y));
                background_group.set_size(Math.round(tw), Math.round(th));
                blurWidget.set_position(0, 0);
                blurWidget.set_size(Math.round(tw), Math.round(th));
                blurWidget.set_clip(0, 0, Math.round(tw), Math.round(th));
                bgManager?._bms_pipeline?.effect?.queue_repaint?.();
            } catch (e) {
                // Dhruva can briefly unmap/reparent actors during auto-hide.
            }
        };

        let signal_ids = [];
        for (let prop of [
            'notify::x', 'notify::y', 'notify::width', 'notify::height',
            'notify::scale-x', 'notify::scale-y', 'notify::translation-x',
            'notify::translation-y', 'notify::pivot-point',
        ])
            signal_ids.push([bgActor, bgActor.connect(prop, sync_geometry)]);

        for (let prop of [
            'notify::x', 'notify::y', 'notify::width', 'notify::height',
            'notify::scale-x', 'notify::scale-y', 'notify::translation-x',
            'notify::translation-y',
        ])
            signal_ids.push([container, container.connect(prop, sync_geometry)]);

        const sync_visibility = () => {
            if (container.visible && bgActor.visible)
                background_group.show();
            else
                background_group.hide();
        };
        signal_ids.push([bgActor, bgActor.connect('notify::visible', sync_visibility)]);
        signal_ids.push([container, container.connect('notify::visible', sync_visibility)]);

        const destroy_id = container.connect('destroy', () => this._unblur_dock(container));

        this._blurred_docks.set(container, { background_group, blurWidget, bgManager, signal_ids, bgActor, destroy_id });
        sync_geometry();
        sync_visibility();
    }

    _unblur_dock(container, state) {
        state ??= this._blurred_docks.get(container);
        if (!state)
            return;

        if (state.destroy_id)
            container.disconnect(state.destroy_id);
        for (let [actor, id] of state.signal_ids)
            actor.disconnect(id);
        state.bgManager?._bms_pipeline?.destroy?.();
        state.blurWidget?.destroy?.();
        state.background_group?.destroy?.();
        this._blurred_docks.delete(container);
    }

    _blur_context_menu(overlay) {
        if (this._blurred_menus.has(overlay))
            return;

        let { menuContainer, panel, bgDrawingArea } = this._find_context_menu_parts(overlay);
        if (!menuContainer || !panel)
            return;

        let state = {
            menuContainer,
            panel,
            bgDrawingArea,
            blurWidget: null,
            bgManager: null,
            pipeline: null,
            signal_ids: [],
        };

        state.destroy_id = overlay.connect('destroy', () => this._unblur_context_menu(overlay));
        state.signal_ids.push([overlay, state.destroy_id]);
        this._blurred_menus.set(overlay, state);

        const inject = () => {
            if (!this._blurred_menus.has(overlay))
                return;
            this._inject_context_menu_blur(overlay);
        };

        state.allocation_id = panel.connect('notify::allocation', inject);
        state.signal_ids.push([panel, state.allocation_id]);

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            inject();
            return GLib.SOURCE_REMOVE;
        });
    }

    _find_context_menu_parts(overlay) {
        let menuContainer = null;
        let panel = null;
        let bgDrawingArea = null;

        for (let child of overlay.get_children()) {
            let children = child.get_children?.() ?? [];
            if (children.length < 2)
                continue;

            let candidatePanel = null;
            let candidateBg = null;
            for (let sub of children) {
                if (sub instanceof St.DrawingArea)
                    candidateBg = sub;
                else if (sub instanceof St.BoxLayout)
                    candidatePanel = sub;
            }

            if (candidatePanel) {
                menuContainer = child;
                panel = candidatePanel;
                bgDrawingArea = candidateBg;
                break;
            }
        }

        return { menuContainer, panel, bgDrawingArea };
    }

    _inject_context_menu_blur(overlay) {
        let state = this._blurred_menus.get(overlay);
        if (!state || state.blurWidget)
            return;

        let { menuContainer, panel, bgDrawingArea } = state;
        let alloc = panel.get_allocation_box();
        let width = alloc.get_width();
        let height = alloc.get_height();
        if (width <= 0 || height <= 0)
            return;

        const pipeline = new DummyPipeline(this.effects_manager, this.settings.dhruva);
        let [blurWidget, bgManager] = pipeline.create_background_with_effect(
            menuContainer, 'bms-dhruva-menu-blurred-widget'
        );

        const sync_geometry = () => {
            let currentAlloc = panel.get_allocation_box();
            let w = currentAlloc.get_width();
            let h = currentAlloc.get_height();
            if (w <= 0 || h <= 0)
                return;

            blurWidget.set_position(currentAlloc.get_x(), currentAlloc.get_y());
            blurWidget.set_size(w, h);
            bgManager?._bms_pipeline?.effect?.queue_repaint?.();
        };

        sync_geometry();

        if (bgDrawingArea)
            menuContainer.set_child_below_sibling(blurWidget, bgDrawingArea);

        blurWidget.opacity = 0;
        blurWidget.set_scale(0.95, 0.95);
        blurWidget.set_pivot_point(menuContainer.pivot_point_x || 0.5,
                                   menuContainer.pivot_point_y || 0.5);
        blurWidget.ease({
            opacity: 255,
            scale_x: 1.0,
            scale_y: 1.0,
            duration: 180,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        for (let prop of ['notify::allocation', 'notify::x', 'notify::y',
            'notify::width', 'notify::height'])
            state.signal_ids.push([panel, panel.connect(prop, sync_geometry)]);

        state.pipeline = pipeline;
        state.blurWidget = blurWidget;
        state.bgManager = bgManager;
    }

    _unblur_context_menu(overlay, state) {
        state ??= this._blurred_menus.get(overlay);
        if (!state)
            return;

        for (let [actor, id] of state.signal_ids) {
            try {
                actor.disconnect(id);
            } catch (e) {
            }
        }

        state.bgManager?._bms_pipeline?.destroy?.();
        state.blurWidget?.destroy?.();
        this._blurred_menus.delete(overlay);
    }

    _find_background_actor(container) {
        let directBackground = container.get_children?.()
            .find(child => child.get_name?.() === 'DhruvaBackground');
        if (directBackground)
            return directBackground;

        let background = null;
        this._walk_actor_tree(container, child => {
            if (!background && child.get_name?.() === 'DhruvaBackground')
                background = child;
        });

        return background;
    }
};
