import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { DisposableStore } from '../runtime/disposable_store.js';
import {
    actorSignature,
    resolveBoxPointer,
    resolvePopupContentActor,
    isManagedOverlayActor,
    isDhruvaContextMenuOverlayActor,
    getOpenStateActor,
} from './actor_utils.js';
import {
    OverlaySurfaceController,
} from './overlay_surface_controller.js';
import { PopupOverlayController } from './popup_overlay_controller.js';
import { QuickSettingsControlBlurLayer } from './quick_settings_control_layer.js';

export class OverlaySurfaceRegistry {
    constructor(runtime) {
        this.runtime = runtime;
        this._popupControllers = new Map();
        this._actorControllers = new Map();
        this._quickSettingsControlLayer = null;
        this._disposables = new DisposableStore();
        this._refresh_source_id = 0;
    }

    init() {
        this._connect(Main.layoutManager.uiGroup, 'child-added', (_group, actor) => {
            if (!isManagedOverlayActor(actor))
                this.queueRefresh();
        });
        this._connect(Main.layoutManager.uiGroup, 'child-removed', (_group, actor) => {
            if (!isManagedOverlayActor(actor))
                this.queueRefresh();
        });
        this._connect(global.stage, 'child-added', (_group, actor) => {
            if (!isManagedOverlayActor(actor))
                this.queueRefresh();
        });
        this._connect(global.stage, 'child-removed', (_group, actor) => {
            if (!isManagedOverlayActor(actor))
                this.queueRefresh();
        });
        this._connect(Main.layoutManager, 'monitors-changed', () => this.queueRefresh());

        for (const panelBox of [Main.panel?._leftBox, Main.panel?._centerBox, Main.panel?._rightBox].filter(Boolean)) {
            this._connect(panelBox, 'child-added', () => this.queueRefresh());
            this._connect(panelBox, 'child-removed', () => this.queueRefresh());
        }

        this.rebuild(true);
    }

    destroy() {
        this._refresh_source_id = 0;
        this._disposables.dispose();

        for (const controller of this._popupControllers.values())
            controller.destroy();
        for (const controller of this._actorControllers.values())
            controller.destroy();
        this._quickSettingsControlLayer?.destroy();

        this._popupControllers.clear();
        this._actorControllers.clear();
        this._quickSettingsControlLayer = null;
    }

    _connect(obj, signal, callback) {
        try {
            this._disposables.addSignal(obj, signal, callback);
        } catch (e) {
            this.runtime._warn(`failed to connect registry signal ${signal}: ${e}`);
        }
    }

    queueRefresh() {
        if (this._refresh_source_id)
            return;

        this._refresh_source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 32, () => {
            this._refresh_source_id = 0;
            if (!this.runtime.enabled)
                return GLib.SOURCE_REMOVE;

            this.rebuild(false);
            return GLib.SOURCE_REMOVE;
        });
        this._disposables.addSource(this._refresh_source_id);
    }

    rebuild(forceGeometrySync) {
        this._rebuildPopupControllers(forceGeometrySync);
        this._rebuildQuickSettingsControlLayer(forceGeometrySync);
        this._rebuildActorControllers(forceGeometrySync);
    }

    isTrackedMenu(menu) {
        if (this._quickSettingsControlLayer?.menu === menu)
            return true;

        for (const controller of this._popupControllers.values()) {
            if (controller.menu === menu)
                return true;
        }
        return false;
    }

    syncAll() {
        for (const controller of this._popupControllers.values())
            controller.sync();
        for (const controller of this._actorControllers.values())
            controller.sync();
        this._quickSettingsControlLayer?.sync();
    }

    _upsertPopupController(id, options, forceGeometrySync = false) {
        let controller = this._popupControllers.get(id);
        if (!controller) {
            controller = new PopupOverlayController(this.runtime, { id, ...options });
            this._popupControllers.set(id, controller);
            controller.enable();
        }

        if (forceGeometrySync)
            controller.syncGeometry();

        return controller;
    }

    _upsertActorController(id, options, forceGeometrySync = false) {
        let controller = this._actorControllers.get(id);
        if (!controller) {
            controller = new OverlaySurfaceController(this.runtime, { id, ...options });
            this._actorControllers.set(id, controller);
            controller.enable();
        }

        if (forceGeometrySync)
            controller.syncGeometry();

        return controller;
    }

    _pruneControllers(map, keepIds) {
        for (const [id, controller] of map.entries()) {
            if (!keepIds.has(id)) {
                controller.destroy();
                map.delete(id);
            }
        }
    }

    _rebuildPopupControllers(forceGeometrySync) {
        const keep = new Set();

        const quickSettingsMenu = Main.panel?.statusArea?.quickSettings?.menu;
        if (quickSettingsMenu?.actor && this.runtime.isTargetEnabled('quick-settings') &&
            this.runtime.settings.overlays.STATIC_BLUR) {
            const id = 'quick-settings';
            keep.add(id);
            this._upsertPopupController(id, {
                target: 'quick-settings',
                menu: quickSettingsMenu,
                getSurfaceActor: () => resolvePopupContentActor(quickSettingsMenu.actor),
                getInsertActor: () => quickSettingsMenu._boxPointer ?? quickSettingsMenu.actor,
                getOpenStateActor: () => getOpenStateActor(quickSettingsMenu, resolvePopupContentActor(quickSettingsMenu.actor)),
            }, forceGeometrySync);
        }

        const dateMenu = Main.panel?.statusArea?.dateMenu?.menu;
        if (dateMenu?.actor && this.runtime.isTargetEnabled('date-menu')) {
            const id = 'date-menu';
            keep.add(id);
            this._upsertPopupController(id, {
                target: 'date-menu',
                menu: dateMenu,
                getSurfaceActor: () => resolvePopupContentActor(dateMenu.actor),
                getInsertActor: () => dateMenu._boxPointer ?? dateMenu.actor,
                getOpenStateActor: () => getOpenStateActor(dateMenu, resolvePopupContentActor(dateMenu.actor)),
            }, forceGeometrySync);
        }

        if (this.runtime.isTargetEnabled('panel-menus')) {
            for (const [name, indicator] of Object.entries(Main.panel?.statusArea ?? {})) {
                const menu = indicator?.menu;
                if (!menu?.actor)
                    continue;
                if (menu === quickSettingsMenu || menu === dateMenu)
                    continue;

                const id = `panel-menu-${name}`;
                keep.add(id);
                this._upsertPopupController(id, {
                    target: 'panel-menus',
                    menu,
                    getSurfaceActor: () => resolvePopupContentActor(menu.actor),
                    getInsertActor: () => menu._boxPointer ?? menu.actor,
                    getOpenStateActor: () => getOpenStateActor(menu, resolvePopupContentActor(menu.actor)),
                }, forceGeometrySync);
            }
        }

        this._pruneControllers(this._popupControllers, keep);
    }

    _rebuildQuickSettingsControlLayer() {
        const quickSettingsMenu = Main.panel?.statusArea?.quickSettings?.menu;
        const enabled = quickSettingsMenu?.actor &&
            this.runtime.isTargetEnabled('quick-settings') &&
            !this.runtime.settings.overlays.STATIC_BLUR;

        if (!enabled) {
            this._quickSettingsControlLayer?.destroy();
            this._quickSettingsControlLayer = null;
            return;
        }

        if (this._quickSettingsControlLayer?.menu !== quickSettingsMenu) {
            this._quickSettingsControlLayer?.destroy();
            this._quickSettingsControlLayer = null;
        }

        if (!this._quickSettingsControlLayer) {
            this._quickSettingsControlLayer =
                new QuickSettingsControlBlurLayer(this.runtime, quickSettingsMenu);
            this._quickSettingsControlLayer.enable();
        } else {
            this._quickSettingsControlLayer.sync();
        }
    }

    _rebuildActorControllers(forceGeometrySync) {
        const keep = new Set();

        if (this.runtime.isTargetEnabled('notifications')) {
            const notifActors = [
                Main.messageTray?._bannerBin,
                Main.panel?.statusArea?.dateMenu?._messageList,
            ].filter(Boolean);

            notifActors.forEach((actor, index) => {
                const id = `notifications-${index}`;
                keep.add(id);
                this._upsertActorController(id, {
                    target: 'notifications',
                    getSurfaceActor: () => actor,
                    getInsertActor: () => actor,
                }, forceGeometrySync);
            });
        }

        if (this.runtime.isTargetEnabled('osd')) {
            const osdActors = (Main.osdWindowManager?._osdWindows ?? [])
                .map(window => window?._hbox)
                .filter(Boolean);

            osdActors.forEach((actor, index) => {
                const id = `osd-${index}`;
                keep.add(id);
                this._upsertActorController(id, {
                    target: 'osd',
                    getSurfaceActor: () => actor,
                    getInsertActor: () => actor,
                }, forceGeometrySync);
            });
        }

        const scanRoots = [Main.layoutManager.uiGroup, global.stage].filter(Boolean);
        for (const root of scanRoots) {
            const stack = [root];
            while (stack.length > 0) {
                const actor = stack.pop();
                if (!actor)
                    continue;

                const styleClass = actor.get_style_class_name?.() ?? '';
                if (this.runtime.isTargetEnabled('desktop-menus') && styleClass.includes('background-menu')) {
                    const id = `desktop-menu-${actorSignature(actor)}`;
                    keep.add(id);
                    this._upsertActorController(id, {
                        target: 'desktop-menus',
                        getSurfaceActor: () => resolvePopupContentActor(actor),
                        getInsertActor: () => resolveBoxPointer(actor) ?? actor,
                    }, forceGeometrySync);
                }

                if (this.runtime.isTargetEnabled('app-menus') && !isDhruvaContextMenuOverlayActor(actor) &&
                    (styleClass.includes('window-menu') || styleClass.includes('app-menu'))) {
                    const id = `app-menu-${actorSignature(actor)}`;
                    keep.add(id);
                    this._upsertActorController(id, {
                        target: 'app-menus',
                        getSurfaceActor: () => resolvePopupContentActor(actor),
                        getInsertActor: () => resolveBoxPointer(actor) ?? actor,
                    }, forceGeometrySync);
                }

                const children = actor.get_children?.();
                if (children?.length)
                    stack.push(...children);
            }
        }

        this._pruneControllers(this._actorControllers, keep);
    }
}
