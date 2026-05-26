import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { Connections } from '../conveniences/connections.js';
import { DisposableStore } from '../runtime/disposable_store.js';
import { DhruvaTargetResolver } from '../integrations/dhruva_target_resolver.js';
import { DhruvaDockSurfaceController } from '../integrations/dhruva_dock_surface_controller.js';
import { DhruvaContextMenuSurfaceController } from '../integrations/dhruva_context_menu_surface_controller.js';

export const DhruvaBlur = class DhruvaBlur {
    constructor(connections, settings, effects_manager) {
        this.connections = connections ?? new Connections();
        this.settings = settings;
        this.effects_manager = effects_manager;
        this.enabled = false;
        this._blurred_docks = new Map();
        this._blurred_menus = new Map();
        this._lifecycle = new DisposableStore();
        this._resolver = new DhruvaTargetResolver();
        this._dockController = new DhruvaDockSurfaceController(effects_manager, settings);
        this._menuController = new DhruvaContextMenuSurfaceController(
            effects_manager,
            settings,
            this._resolver
        );
    }

    enable() {
        if (this.enabled)
            return;

        // Mark enabled before hooking/scanning so async hooks honor current state.
        this.enabled = true;

        this.connections.connect(Main.uiGroup, 'child-added',
            (_, actor) => this._scan_actor_tree(actor));
        this.connections.connect(global.stage, 'child-added',
            (_, actor) => this._scan_actor_tree(actor));

        this._scan_all_roots();
        for (let delay of [500, 2000, 5000, 10000]) {
            let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                if (!this.enabled)
                    return GLib.SOURCE_REMOVE;
                this._scan_all_roots();
                return GLib.SOURCE_REMOVE;
            });
            this._lifecycle.addSource(id);
        }
    }

    disable() {
        for (let [container, state] of this._blurred_docks)
            this._unblur_dock(container, state);
        this._blurred_docks.clear();

        for (let [overlay, state] of this._blurred_menus)
            this._unblur_context_menu(overlay, state);
        this._blurred_menus.clear();

        this._lifecycle.dispose();
        this._lifecycle = new DisposableStore();
        this.connections.disconnect_all();
        this.enabled = false;
    }

    _scan_all_roots() {
        for (let root of [Main.uiGroup, global.stage])
            this._scan_actor_tree(root);
    }

    _scan_actor_tree(actor) {
        if (!this.enabled)
            return;

        this._try_blur_dock_actor(actor);
        this._try_blur_menu_actor(actor);
        this._resolver.walkActorTree(actor, child => {
            this._try_blur_dock_actor(child);
            this._try_blur_menu_actor(child);
        });
    }

    _try_blur_dock_actor(actor) {
        const container = this._resolver.findContainer(actor);
        if (!container || this._blurred_docks.has(container))
            return;

        const bgActor = this._resolver.findBackgroundActor(container);
        const state = this._dockController.attach(container, bgActor);
        if (!state)
            return;

        state.disposables.addSignal(container, 'destroy', () => this._unblur_dock(container));
        this._blurred_docks.set(container, state);
    }

    _try_blur_menu_actor(actor) {
        if (!this._resolver.isMenuOverlay(actor) || this._blurred_menus.has(actor))
            return;

        const state = this._menuController.createState(actor);
        if (!state)
            return;

        this._blurred_menus.set(actor, state);
        this._menuController.scheduleAttach(state, () => this._unblur_context_menu(actor));
    }

    _unblur_dock(container, state) {
        state ??= this._blurred_docks.get(container);
        if (!state)
            return;

        state.disposables?.dispose();
        state.bgManager?._bms_pipeline?.destroy?.();
        state.blurWidget?.destroy?.();
        state.background_group?.destroy?.();
        this._blurred_docks.delete(container);
    }

    _unblur_context_menu(overlay, state) {
        state ??= this._blurred_menus.get(overlay);
        if (!state)
            return;

        state.tracker?.dispose();
        state.disposables?.dispose();
        state.bgManager?._bms_pipeline?.destroy?.();
        state.blurWidget?.destroy?.();
        this._blurred_menus.delete(overlay);
    }
};
