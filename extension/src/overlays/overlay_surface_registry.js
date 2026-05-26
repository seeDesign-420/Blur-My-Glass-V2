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

const REGISTRY_REFRESH_DEBOUNCE_MS = 100;

export class OverlaySurfaceRegistry {
    constructor(runtime) {
        this.runtime = runtime;
        this._popupControllers = new Map();
        this._actorControllers = new Map();
        this._quickSettingsControlLayer = null;
        this._disposables = new DisposableStore();
        this._broadWatcherDisposables = new DisposableStore();
        this._broadWatchersEnabled = false;
        this._refresh_source_id = 0;
    }

    init() {
        this._connect(Main.layoutManager, 'monitors-changed', () => this.queueRefresh('monitors-changed'));

        for (const panelBox of [Main.panel?._leftBox, Main.panel?._centerBox, Main.panel?._rightBox].filter(Boolean)) {
            this._connect(panelBox, 'child-added', () => this.queueRefresh('panel-box-child-added'));
            this._connect(panelBox, 'child-removed', () => this.queueRefresh('panel-box-child-removed'));
        }

        this._syncBroadActorWatchers();
        this.rebuild(true);
    }

    destroy() {
        this._refresh_source_id = 0;
        this._disposables.dispose();
        this._broadWatcherDisposables.dispose();

        for (const controller of this._popupControllers.values())
            controller.destroy();
        for (const controller of this._actorControllers.values())
            controller.destroy();
        this._quickSettingsControlLayer?.destroy();

        this._popupControllers.clear();
        this._actorControllers.clear();
        this._quickSettingsControlLayer = null;
        this._broadWatchersEnabled = false;
    }

    _connect(obj, signal, callback) {
        this._connectWithStore(this._disposables, obj, signal, callback);
    }

    _connectWithStore(store, obj, signal, callback) {
        try {
            store.addSignal(obj, signal, callback);
        } catch (e) {
            this.runtime._warn(`failed to connect registry signal ${signal}: ${e}`);
        }
    }

    _needsTreeScan() {
        return Boolean(this.runtime.isTargetEnabled('desktop-menus') ||
            this.runtime.isTargetEnabled('app-menus'));
    }

    _syncBroadActorWatchers() {
        const shouldEnable = this._needsTreeScan();
        if (shouldEnable === this._broadWatchersEnabled)
            return;

        this._broadWatcherDisposables.dispose();
        this._broadWatcherDisposables = new DisposableStore();
        this._broadWatchersEnabled = shouldEnable;

        if (!shouldEnable)
            return;

        this._connectWithStore(this._broadWatcherDisposables, Main.layoutManager.uiGroup,
            'child-added', (_group, actor) => this._onBroadActorMutation(actor, 'uiGroup-added'));
        this._connectWithStore(this._broadWatcherDisposables, Main.layoutManager.uiGroup,
            'child-removed', (_group, actor) => this._onBroadActorMutation(actor, 'uiGroup-removed'));
        this._connectWithStore(this._broadWatcherDisposables, global.stage,
            'child-added', (_group, actor) => this._onBroadActorMutation(actor, 'stage-added'));
        this._connectWithStore(this._broadWatcherDisposables, global.stage,
            'child-removed', (_group, actor) => this._onBroadActorMutation(actor, 'stage-removed'));
    }

    _onBroadActorMutation(actor, reason) {
        if (isManagedOverlayActor(actor))
            return;
        if (!this._isLikelyMenuCandidate(actor))
            return;

        this.queueRefresh(`broad-${reason}`);
    }

    _isLikelyMenuCandidate(actor) {
        if (!actor)
            return false;

        let styleClass = '';
        let actorName = '';
        try {
            styleClass = (actor.get_style_class_name?.() ?? '').toLowerCase();
            actorName = (actor.get_name?.() ?? '').toLowerCase();
        } catch {
            return false;
        }

        if (styleClass.includes('background-menu') || styleClass.includes('window-menu') ||
            styleClass.includes('app-menu') || styleClass.includes('popup-menu'))
            return true;

        if (styleClass.includes('menu') || actorName.includes('menu') || actorName.includes('popup'))
            return true;

        return Boolean(actor._boxPointer || actor._delegate?.box);
    }

    queueRefresh(reason = 'generic') {
        if (this.runtime.isOverlayWorkSuspended()) {
            this.runtime._perfCount('registry.refresh_skipped_suspended');
            this.runtime._markPendingOverlayRefresh(reason);
            return;
        }

        if (this._refresh_source_id)
            return;

        this.runtime._perfCount('registry.refresh_count');
        this._refresh_source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, REGISTRY_REFRESH_DEBOUNCE_MS, () => {
            this._refresh_source_id = 0;
            if (!this.runtime.enabled)
                return GLib.SOURCE_REMOVE;
            if (this.runtime.isOverlayWorkSuspended()) {
                this.runtime._perfCount('registry.refresh_skipped_suspended');
                this.runtime._markPendingOverlayRefresh(`${reason}-timeout`);
                return GLib.SOURCE_REMOVE;
            }

            this.rebuild(false);
            return GLib.SOURCE_REMOVE;
        });
        this._disposables.addSource(this._refresh_source_id);

        if (this.runtime.settings.DEBUG)
            this.runtime._log(`queued overlay refresh (${reason})`);
    }

    rebuild(forceGeometrySync) {
        this._syncBroadActorWatchers();

        if (this.runtime.isOverlayWorkSuspended()) {
            this.runtime._perfCount('registry.rebuild_suspended');
            this._syncExistingControllers();
            return;
        }

        this.runtime._perfCount('registry.rebuild_count');
        const rebuildStart = this.runtime._perfStart();

        this._rebuildPopupControllers(forceGeometrySync);
        this._rebuildQuickSettingsControlLayer(forceGeometrySync);
        this._rebuildActorControllers(forceGeometrySync);

        this.runtime._perfSet('registry.popup_controller_count', this._popupControllers.size);
        this.runtime._perfSet('registry.actor_controller_count', this._actorControllers.size);
        this.runtime._perfEnd('registry.rebuild', rebuildStart,
            `popup=${this._popupControllers.size} actor=${this._actorControllers.size}`);
    }

    _syncExistingControllers() {
        for (const controller of this._popupControllers.values())
            controller.sync();
        for (const controller of this._actorControllers.values())
            controller.sync();
        this._quickSettingsControlLayer?.sync();
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
            this.runtime._perfCount('controllers.created');
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
            this.runtime._perfCount('controllers.created');
            controller.enable();
        }

        if (forceGeometrySync)
            controller.syncGeometry();

        return controller;
    }

    _pruneControllers(map, keepIds) {
        for (const [id, controller] of map.entries()) {
            if (!keepIds.has(id)) {
                try {
                    controller.destroy();
                } catch {
                    // Controllers can already be mid-teardown when Shell disposes them.
                }
                map.delete(id);
                this.runtime._perfCount('controllers.destroyed');
            }
        }
    }

    _rebuildPopupControllers(forceGeometrySync) {
        const keep = new Set();

        const quickSettingsMenu = Main.panel?.statusArea?.quickSettings?.menu;

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
            this.runtime.isTargetEnabled('quick-settings');

        if (!enabled) {
            this._quickSettingsControlLayer?.destroy();
            this._quickSettingsControlLayer = null;
            this.runtime._perfSet('quick-settings.surface-count', 0);
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

        if (this._needsTreeScan())
            this._rebuildTreeScannedMenuControllers(keep, forceGeometrySync);

        this._pruneControllers(this._actorControllers, keep);
    }

    _rebuildTreeScannedMenuControllers(keep, forceGeometrySync) {
        const desktopMenusEnabled = this.runtime.isTargetEnabled('desktop-menus');
        const appMenusEnabled = this.runtime.isTargetEnabled('app-menus');

        if (!desktopMenusEnabled && !appMenusEnabled)
            return;

        this.runtime._perfCount('registry.tree_scan_count');
        const treeScanStart = this.runtime._perfStart();
        let scannedActors = 0;

        const scanRoots = [Main.layoutManager.uiGroup, global.stage].filter(Boolean);
        for (const root of scanRoots) {
            const stack = [root];
            while (stack.length > 0) {
                const actor = stack.pop();
                if (!actor)
                    continue;

                scannedActors++;

                let styleClass = '';
                try {
                    styleClass = actor.get_style_class_name?.() ?? '';
                } catch {
                    continue;
                }
                if (desktopMenusEnabled && styleClass.includes('background-menu')) {
                    let signature = '';
                    try {
                        signature = actorSignature(actor);
                    } catch {
                        continue;
                    }
                    const id = `desktop-menu-${signature}`;
                    keep.add(id);
                    this._upsertActorController(id, {
                        target: 'desktop-menus',
                        getSurfaceActor: () => resolvePopupContentActor(actor),
                        getInsertActor: () => resolveBoxPointer(actor) ?? actor,
                    }, forceGeometrySync);
                }

                if (appMenusEnabled && !isDhruvaContextMenuOverlayActor(actor) &&
                    (styleClass.includes('window-menu') || styleClass.includes('app-menu'))) {
                    let signature = '';
                    try {
                        signature = actorSignature(actor);
                    } catch {
                        continue;
                    }
                    const id = `app-menu-${signature}`;
                    keep.add(id);
                    this._upsertActorController(id, {
                        target: 'app-menus',
                        getSurfaceActor: () => resolvePopupContentActor(actor),
                        getInsertActor: () => resolveBoxPointer(actor) ?? actor,
                    }, forceGeometrySync);
                }

                try {
                    const children = actor.get_children?.();
                    if (children?.length)
                        stack.push(...children);
                } catch {
                    continue;
                }
            }
        }

        this.runtime._perfCount('registry.actors_scanned', scannedActors);
        this.runtime._perfEnd('registry.tree_scan', treeScanStart, `actors=${scannedActors}`);
    }
}
