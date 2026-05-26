import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';

import { Pipeline } from '../conveniences/pipeline.js';
import { DummyPipeline } from '../conveniences/dummy_pipeline.js';

const GEOMETRY_SIGNALS = [
    'notify::allocation',
    'notify::x',
    'notify::y',
    'notify::width',
    'notify::height',
    'notify::scale-x',
    'notify::scale-y',
    'notify::translation-x',
    'notify::translation-y',
    'notify::pivot-point',
];

const TARGET_TUNING = Object.freeze({
    'date-menu': Object.freeze({
        sigma_multiplier: 1.0,
        brightness_multiplier: 1.0,
        vibrancy_multiplier: 1.0,
        corner_radius_multiplier: 1.0,
    }),
    'quick-settings': Object.freeze({
        sigma_multiplier: 0.95,
        brightness_multiplier: 0.95,
        vibrancy_multiplier: 0.95,
        corner_radius_multiplier: 1.0,
    }),
    'notifications': Object.freeze({
        sigma_multiplier: 0.9,
        brightness_multiplier: 0.88,
        vibrancy_multiplier: 0.82,
        corner_radius_offset: -4,
        refraction_strength_multiplier: 0.95,
    }),
    osd: Object.freeze({
        sigma_multiplier: 0.85,
        brightness_multiplier: 0.9,
        vibrancy_multiplier: 0.85,
        corner_radius_offset: -2,
        refraction_strength_multiplier: 0.9,
    }),
    'desktop-menus': Object.freeze({
        sigma_multiplier: 0.9,
        brightness_multiplier: 0.92,
        vibrancy_multiplier: 0.9,
        corner_radius_offset: -6,
    }),
    'app-menus': Object.freeze({
        sigma_multiplier: 0.9,
        brightness_multiplier: 0.92,
        vibrancy_multiplier: 0.9,
        corner_radius_offset: -6,
    }),
    'panel-menus': Object.freeze({
        sigma_multiplier: 0.92,
        brightness_multiplier: 0.94,
        vibrancy_multiplier: 0.92,
        corner_radius_offset: -2,
    }),
});

const OPEN_ANIMATION_DURATION_MS = 180;
const CLOSE_ANIMATION_DURATION_MS = 220;

function actorSignature(actor) {
    if (!actor)
        return '<null>';

    const typeName = actor.constructor?.name ?? 'UnknownActor';
    const name = actor.get_name?.() ?? '';
    const styleClass = actor.get_style_class_name?.() ?? '';
    return `${typeName}:${name}:${styleClass}`;
}

function isPositiveSize(actor) {
    if (!actor)
        return false;

    const width = actor.width ?? actor.get_width?.() ?? 0;
    const height = actor.height ?? actor.get_height?.() ?? 0;
    return width > 0 && height > 0;
}

function getTransformPosition(actor) {
    try {
        return actor?.get_transformed_position?.() ?? [0, 0];
    } catch {
        return [0, 0];
    }
}

function getTransformSize(actor) {
    try {
        return actor?.get_transformed_size?.() ?? [0, 0];
    } catch {
        return [0, 0];
    }
}

function stageRectToActorSpace(actor, x, y, width, height) {
    try {
        const [ok1, x1, y1] = actor.transform_stage_point(x, y);
        const [ok2, x2, y2] = actor.transform_stage_point(x + width, y + height);
        if (ok1 && ok2) {
            return {
                x: Math.min(x1, x2),
                y: Math.min(y1, y2),
                width: Math.abs(x2 - x1),
                height: Math.abs(y2 - y1),
            };
        }
    } catch {
        // Fall through to a simple translated stage-space approximation.
    }

    const [parentX, parentY] = getTransformPosition(actor);
    return {
        x: x - parentX,
        y: y - parentY,
        width,
        height,
    };
}

function resolveBoxPointer(actor) {
    if (!actor)
        return null;

    if (actor.bin)
        return actor;

    const boxPointer = actor._boxPointer ?? actor._delegate?._boxPointer ?? null;
    if (boxPointer?.bin)
        return boxPointer;

    return null;
}

function isDrawingArea(actor) {
    try {
        return actor instanceof St.DrawingArea;
    } catch {
        return actor?.constructor?.name === 'DrawingArea';
    }
}

function resolvePopupContentActor(actor) {
    if (!actor)
        return null;

    const delegate = actor._delegate ?? actor._boxPointer?._delegate ?? null;
    if (delegate?.box)
        return delegate.box;

    const boxPointer = resolveBoxPointer(actor);
    if (boxPointer?.bin?.get_child) {
        const child = boxPointer.bin.get_child();
        if (child)
            return child;
    }

    const candidates = [];
    const queue = [...(actor.get_children?.() ?? [])];
    while (queue.length > 0) {
        const child = queue.shift();
        if (!child)
            continue;

        if (child.visible && child.mapped && isPositiveSize(child) && !isDrawingArea(child))
            candidates.push(child);

        const children = child.get_children?.();
        if (children?.length)
            queue.push(...children);
    }

    if (candidates.length > 0) {
        candidates.sort((a, b) => {
            const areaA = (a.width ?? a.get_width?.() ?? 0) * (a.height ?? a.get_height?.() ?? 0);
            const areaB = (b.width ?? b.get_width?.() ?? 0) * (b.height ?? b.get_height?.() ?? 0);
            return areaB - areaA;
        });
        return candidates[0];
    }

    return actor;
}

function isManagedOverlayActor(actor) {
    if (!actor)
        return false;

    const name = actor.get_name?.() ?? '';
    if (name.startsWith('bms-overlay-'))
        return true;

    const styleClass = actor.get_style_class_name?.() ?? '';
    return styleClass.includes('bms-overlay-');
}

function isDhruvaContextMenuOverlayActor(actor) {
    if (!actor)
        return false;

    const styleClass = actor.get_style_class_name?.() ?? '';
    return styleClass.includes('context-menu-overlay');
}

function getOverlayTuning(name) {
    return TARGET_TUNING[name] ?? {};
}

function getOpenStateActor(menu, popupContent) {
    return menu?._boxPointer ?? menu?.actor ?? popupContent;
}

class OverlaySurfaceController {
    constructor(runtime, options) {
        this.runtime = runtime;
        this.id = options.id;
        this.target = options.target;
        this.getSurfaceActor = options.getSurfaceActor;
        this.getInsertActor = options.getInsertActor;
        this.getOpenStateActor = options.getOpenStateActor;

        this.background_group = null;
        this.background_actor = null;
        this.bg_manager = null;
        this.surfaceActor = null;
        this.insertActor = null;

        this._signal_ids = [];
        this._parent_signal_ids = [];
        this._close_source_id = 0;
        this._open_source_id = 0;
        this._shown = false;
        this.destroyed = false;
    }

    enable() {
        if (this.destroyed)
            return;

        this.surfaceActor = this.getSurfaceActor?.() ?? null;
        this.insertActor = this.getInsertActor?.() ?? this.surfaceActor;

        if (!this.surfaceActor || !this.insertActor)
            return;

        this._connectLifecycle(this.surfaceActor);
        if (this.insertActor !== this.surfaceActor)
            this._connectLifecycle(this.insertActor);

        this.sync();
    }

    _connectLifecycle(actor) {
        if (!actor)
            return;

        this._connect(actor, 'destroy', () => this.destroy());
        this._connect(actor, 'notify::visible', () => this.sync());
        this._connect(actor, 'notify::mapped', () => this.sync());

        for (const signal of GEOMETRY_SIGNALS)
            this._connect(actor, signal, () => this.syncGeometry());
    }

    _connect(actor, signal, callback) {
        try {
            const id = actor.connect(signal, callback);
            this._signal_ids.push([actor, id]);
        } catch (e) {
            this.runtime._logSkipOnce(this.target, actor, `could not connect ${signal}: ${e}`);
        }
    }

    _connectParent(parent) {
        if (!parent)
            return;

        this._disconnectList(this._parent_signal_ids);
        for (const signal of GEOMETRY_SIGNALS)
            this._connectParentSignal(parent, signal, () => this.syncGeometry());
        this._connectParentSignal(parent, 'notify::visible', () => this.sync());
        this._connectParentSignal(parent, 'notify::mapped', () => this.sync());
    }

    _connectParentSignal(parent, signal, callback) {
        try {
            const id = parent.connect(signal, callback);
            this._parent_signal_ids.push([parent, id]);
        } catch (e) {
            this.runtime._logSkipOnce(this.target, parent, `could not connect ${signal}: ${e}`);
        }
    }

    _disconnectList(list) {
        for (const [actor, id] of list) {
            try {
                actor.disconnect(id);
            } catch {
                // Actor can already be gone.
            }
        }
        list.length = 0;
    }

    _isEnabledBySettings() {
        return this.runtime.isTargetEnabled(this.target);
    }

    _isReadyForOpen() {
        return Boolean(this.surfaceActor?.visible && this.surfaceActor?.mapped && isPositiveSize(this.surfaceActor));
    }

    _isVisuallyGone() {
        return !this.surfaceActor || !this.surfaceActor.visible || !this.surfaceActor.mapped;
    }

    _scheduleOpenSync() {
        if (this._open_source_id)
            return;

        this._open_source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, OPEN_ANIMATION_DURATION_MS, () => {
            this._open_source_id = 0;
            this.syncGeometry();
            return GLib.SOURCE_REMOVE;
        });
    }

    _scheduleCloseHide() {
        if (this._close_source_id)
            return;

        this._close_source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CLOSE_ANIMATION_DURATION_MS, () => {
            this._close_source_id = 0;
            if (!this.destroyed && this._isVisuallyGone())
                this.hide();
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelTimers() {
        if (this._open_source_id) {
            GLib.source_remove(this._open_source_id);
            this._open_source_id = 0;
        }
        if (this._close_source_id) {
            GLib.source_remove(this._close_source_id);
            this._close_source_id = 0;
        }
    }

    sync() {
        if (this.destroyed)
            return;

        if (!this._isEnabledBySettings()) {
            this.hide();
            return;
        }

        if (!this.surfaceActor || !this.insertActor) {
            this.enable();
            return;
        }

        if (!this._isReadyForOpen()) {
            this._scheduleCloseHide();
            return;
        }

        this._cancelTimers();
        this.show();
        this._scheduleOpenSync();
        this.syncGeometry();
    }

    show() {
        if (this._shown)
            return;

        const parent = this.insertActor?.get_parent?.();
        if (!parent)
            return;

        if (!this.background_group)
            this._createBackground();
        if (!this.background_group || !this.background_actor)
            return;

        try {
            parent.insert_child_below(this.background_group, this.insertActor);
            this._connectParent(parent);
            this._shown = true;
        } catch (e) {
            this.runtime._warn(`failed to show ${this.id}: ${e}`);
            this._destroyBackground();
        }
    }

    hide() {
        this._shown = false;
        this._disconnectList(this._parent_signal_ids);

        if (this.background_group?.get_parent?.()) {
            try {
                this.background_group.get_parent().remove_child(this.background_group);
            } catch {
                // Ignore detach failures.
            }
        }

        this._destroyBackground();
    }

    _createBackground() {
        const monitor = this.runtime.findMonitorForActor(this.surfaceActor);
        if (!monitor)
            return;

        this.background_group = new Meta.BackgroundGroup({
            name: `bms-overlay-${this.id}-backgroundgroup`,
            width: 0,
            height: 0,
        });

        if (this.runtime.settings.overlays.STATIC_BLUR) {
            const background_managers = [];
            const pipeline = new Pipeline(
                this.runtime.effects_manager,
                global.blur_my_shell._pipelines_manager,
                this.runtime.settings.overlays.PIPELINE
            );
            this.background_actor = pipeline.create_background_with_effects(
                monitor.index,
                background_managers,
                this.background_group,
                `bms-overlay-${this.id}-blurred-widget`,
                false
            );
            this.bg_manager = background_managers[0] ?? null;
        } else {
            const pipeline = new DummyPipeline(
                this.runtime.effects_manager,
                this.runtime.settings.overlays,
                null,
                getOverlayTuning(this.target)
            );
            [this.background_actor, this.bg_manager] = pipeline.create_background_with_effect(
                this.background_group,
                `bms-overlay-${this.id}-blurred-widget`
            );
        }
    }

    _destroyBackground() {
        if (this.bg_manager?._bms_pipeline) {
            try {
                this.bg_manager._bms_pipeline.destroy();
            } catch {
                // Ignore pipeline destruction errors.
            }
        }

        try {
            this.bg_manager?.destroy?.();
        } catch {
            // Ignore helper destruction errors.
        }

        try {
            this.background_group?.destroy?.();
        } catch {
            // Ignore destruction errors.
        }

        this.background_group = null;
        this.background_actor = null;
        this.bg_manager = null;
    }

    syncGeometry() {
        if (!this._shown || this.destroyed || !this.background_actor || !this.surfaceActor)
            return;

        const parent = this.background_group?.get_parent?.();
        if (!parent)
            return;

        const monitor = this.runtime.findMonitorForActor(this.surfaceActor);
        if (!monitor)
            return;

        const [stageX, stageY] = getTransformPosition(this.surfaceActor);
        let [stageWidth, stageHeight] = getTransformSize(this.surfaceActor);
        if (stageWidth <= 0 || stageHeight <= 0) {
            stageWidth = this.surfaceActor.width ?? this.surfaceActor.get_width?.() ?? 1;
            stageHeight = this.surfaceActor.height ?? this.surfaceActor.get_height?.() ?? 1;
        }

        const targetRect = stageRectToActorSpace(parent, stageX, stageY, stageWidth, stageHeight);
        const localX = Math.round(targetRect.x);
        const localY = Math.round(targetRect.y);
        const localWidth = Math.max(1, Math.round(targetRect.width));
        const localHeight = Math.max(1, Math.round(targetRect.height));

        try {
            if (this.runtime.settings.overlays.STATIC_BLUR) {
                const monitorRect = stageRectToActorSpace(
                    parent,
                    monitor.x,
                    monitor.y,
                    monitor.width,
                    monitor.height
                );
                const monitorX = Math.round(monitorRect.x);
                const monitorY = Math.round(monitorRect.y);
                const monitorWidth = Math.max(1, Math.round(monitorRect.width));
                const monitorHeight = Math.max(1, Math.round(monitorRect.height));

                this.background_group.x = monitorX;
                this.background_group.y = monitorY;
                this.background_group.width = monitorWidth;
                this.background_group.height = monitorHeight;
                this.background_actor.x = 0;
                this.background_actor.y = 0;
                this.background_actor.width = monitorWidth;
                this.background_actor.height = monitorHeight;
                this.background_actor.set_clip(
                    localX - monitorX,
                    localY - monitorY,
                    localWidth,
                    localHeight
                );
            } else {
                this.background_group.x = localX;
                this.background_group.y = localY;
                this.background_group.width = localWidth;
                this.background_group.height = localHeight;
                this.background_actor.x = 0;
                this.background_actor.y = 0;
                this.background_actor.width = localWidth;
                this.background_actor.height = localHeight;
                this.background_actor.set_clip(0, 0, localWidth, localHeight);
            }

            this.bg_manager?._bms_pipeline?.repaint_effect?.();
        } catch (e) {
            this.runtime._logSkipOnce(this.target, this.surfaceActor, `geometry sync failed: ${e}`);
            this.hide();
        }
    }

    destroy() {
        if (this.destroyed)
            return;

        this.destroyed = true;
        this._cancelTimers();
        this.hide();
        this._disconnectList(this._signal_ids);
        this._disconnectList(this._parent_signal_ids);
    }
}

class PopupOverlayController extends OverlaySurfaceController {
    constructor(runtime, options) {
        super(runtime, options);
        this.menu = options.menu;
        this._menu_signal_ids = [];
    }

    enable() {
        this.surfaceActor = this.getSurfaceActor?.() ?? null;
        this.insertActor = this.getInsertActor?.() ?? this.surfaceActor;

        if (!this.menu || !this.surfaceActor || !this.insertActor)
            return;

        this._connectLifecycle(this.surfaceActor);
        if (this.insertActor !== this.surfaceActor)
            this._connectLifecycle(this.insertActor);

        this._connectMenu();
        this.sync();
    }

    _connectMenu() {
        const connect = (obj, signal, callback) => {
            try {
                const id = obj.connect(signal, callback);
                this._menu_signal_ids.push([obj, id]);
            } catch (e) {
                this.runtime._logSkipOnce(this.target, obj, `could not connect ${signal}: ${e}`);
            }
        };

        connect(this.menu, 'open-state-changed', (_menu, open) => {
            if (open) {
                this._cancelTimers();
                this.show();
                this._scheduleOpenSync();
                this.syncGeometry();
            } else {
                this._scheduleCloseHide();
            }
        });

        if (this.menu.actor)
            connect(this.menu.actor, 'destroy', () => this.destroy());

        const opacityActor = this.getOpenStateActor?.() ?? getOpenStateActor(this.menu, this.surfaceActor);
        if (opacityActor && opacityActor !== this.surfaceActor)
            this._connectLifecycle(opacityActor);
    }

    _isReadyForOpen() {
        if (!this.menu)
            return false;
        if (!this.menu.isOpen)
            return !this._isVisuallyGone();

        return super._isReadyForOpen();
    }

    destroy() {
        for (const [obj, id] of this._menu_signal_ids) {
            try {
                obj.disconnect(id);
            } catch {
                // Ignore disconnection errors.
            }
        }
        this._menu_signal_ids = [];
        super.destroy();
    }
}

class OverlayHookManager {
    constructor(runtime) {
        this.runtime = runtime;
        this._popupOpenOverride = null;
        this._popupCloseOverride = null;
        this._popupDestroyOverride = null;
        this._dynamicMenus = new Map();
        this._nextId = 1;
    }

    install() {
        if (this._popupOpenOverride)
            return;

        this._popupOpenOverride = PopupMenu.PopupMenu.prototype.open;
        this._popupCloseOverride = PopupMenu.PopupMenu.prototype.close;
        this._popupDestroyOverride = PopupMenu.PopupMenu.prototype.destroy;

        const manager = this;
        PopupMenu.PopupMenu.prototype.open = function (...args) {
            if (args.length === 0 || args[0] === undefined)
                args[0] = BoxPointer.PopupAnimation.FULL;
            const result = manager._popupOpenOverride.apply(this, args);
            manager._maybeTrackDynamicMenu(this);
            manager._dynamicMenus.get(this)?.sync();
            return result;
        };

        PopupMenu.PopupMenu.prototype.close = function (...args) {
            if (args.length === 0 || args[0] === undefined)
                args[0] = BoxPointer.PopupAnimation.FULL;
            return manager._popupCloseOverride.apply(this, args);
        };

        PopupMenu.PopupMenu.prototype.destroy = function (...args) {
            manager._untrackDynamicMenu(this);
            return manager._popupDestroyOverride.apply(this, args);
        };
    }

    uninstall() {
        if (!this._popupOpenOverride)
            return;

        PopupMenu.PopupMenu.prototype.open = this._popupOpenOverride;
        PopupMenu.PopupMenu.prototype.close = this._popupCloseOverride;
        PopupMenu.PopupMenu.prototype.destroy = this._popupDestroyOverride;

        this._popupOpenOverride = null;
        this._popupCloseOverride = null;
        this._popupDestroyOverride = null;

        for (const controller of this._dynamicMenus.values())
            controller.destroy();
        this._dynamicMenus.clear();
    }

    syncAll() {
        for (const controller of this._dynamicMenus.values())
            controller.sync();
    }

    _isTrackedMenu(menu) {
        if (this._dynamicMenus.has(menu))
            return true;

        return this.runtime._registry?.isTrackedMenu(menu) ?? false;
    }

    _isEligibleDynamicMenu(menu) {
        if (!menu?.actor || !menu?.box)
            return false;

        if (this._isTrackedMenu(menu))
            return false;

        const parent = menu.actor.get_parent?.();
        if (!parent)
            return false;

        return parent === Main.layoutManager.uiGroup;
    }

    _maybeTrackDynamicMenu(menu) {
        if (!this._isEligibleDynamicMenu(menu))
            return;

        const styleClass = menu.actor.get_style_class_name?.() ?? '';
        const target = styleClass.includes('background-menu')
            ? 'desktop-menus'
            : 'panel-menus';

        const content = resolvePopupContentActor(menu.actor);
        if (!content)
            return;

        const id = `dynamic-popup-${this._nextId++}`;
        const controller = new PopupOverlayController(this.runtime, {
            id,
            target,
            menu,
            getSurfaceActor: () => resolvePopupContentActor(menu.actor),
            getInsertActor: () => menu._boxPointer ?? menu.actor,
            getOpenStateActor: () => getOpenStateActor(menu, content),
        });

        this._dynamicMenus.set(menu, controller);
        controller.enable();
    }

    _untrackDynamicMenu(menu) {
        const controller = this._dynamicMenus.get(menu);
        if (!controller)
            return;

        controller.destroy();
        this._dynamicMenus.delete(menu);
    }
}

class OverlaySurfaceRegistry {
    constructor(runtime) {
        this.runtime = runtime;
        this._popupControllers = new Map();
        this._actorControllers = new Map();
        this._signals = [];
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
        if (this._refresh_source_id) {
            GLib.source_remove(this._refresh_source_id);
            this._refresh_source_id = 0;
        }

        for (const [obj, id] of this._signals) {
            try {
                obj.disconnect(id);
            } catch {
                // ignore
            }
        }
        this._signals = [];

        for (const controller of this._popupControllers.values())
            controller.destroy();
        for (const controller of this._actorControllers.values())
            controller.destroy();

        this._popupControllers.clear();
        this._actorControllers.clear();
    }

    _connect(obj, signal, callback) {
        try {
            const id = obj.connect(signal, callback);
            this._signals.push([obj, id]);
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
    }

    rebuild(forceGeometrySync) {
        this._rebuildPopupControllers(forceGeometrySync);
        this._rebuildActorControllers(forceGeometrySync);
    }

    isTrackedMenu(menu) {
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
    }

    _upsertPopupController(id, options, forceGeometrySync = false) {
        let controller = this._popupControllers.get(id);
        if (!controller) {
            controller = new PopupOverlayController(this.runtime, {id, ...options});
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
            controller = new OverlaySurfaceController(this.runtime, {id, ...options});
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
        if (quickSettingsMenu?.actor && this.runtime.isTargetEnabled('quick-settings')) {
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

export const OverlaysBlur = class OverlaysBlur {
    constructor(connections, settings, effects_manager) {
        this.connections = connections;
        this.settings = settings;
        this.effects_manager = effects_manager;
        this.enabled = false;
        this._skip_log = new Set();
        this._registry = null;
        this._hooks = null;
    }

    enable() {
        if (this.enabled)
            return;

        this._log('enabling overlay blur runtime');
        this.enabled = true;

        this._registry = new OverlaySurfaceRegistry(this);
        this._registry.init();

        this._hooks = new OverlayHookManager(this);
        this._hooks.install();
        this._hooks.syncAll();
    }

    disable() {
        if (!this.enabled)
            return;

        this._log('disabling overlay blur runtime');

        this._hooks?.uninstall();
        this._hooks = null;

        this._registry?.destroy();
        this._registry = null;

        this._skip_log.clear();
        this.connections.disconnect_all();
        this.enabled = false;
    }

    syncTargets(rebuildAttached = false) {
        if (!this.enabled)
            return;

        if (rebuildAttached)
            this._registry?.rebuild(true);
        else
            this._registry?.rebuild(false);

        this._registry?.syncAll();
        this._hooks?.syncAll();
    }

    isTargetEnabled(target) {
        return this.settings.overlays.BLUR && {
            'date-menu': this.settings.overlays.DATE_MENU,
            'quick-settings': this.settings.overlays.QUICK_SETTINGS,
            notifications: this.settings.overlays.NOTIFICATIONS,
            osd: this.settings.overlays.OSD,
            'desktop-menus': this.settings.overlays.DESKTOP_MENUS,
            'app-menus': this.settings.overlays.APP_MENUS,
            'panel-menus': this.settings.overlays.APP_MENUS || this.settings.overlays.DATE_MENU || this.settings.overlays.QUICK_SETTINGS,
        }[target];
    }

    findMonitorForActor(actor) {
        try {
            return Main.layoutManager.findMonitorForActor(actor) ??
                Main.layoutManager.findMonitorForActor(actor.get_parent?.()) ??
                Main.layoutManager.primaryMonitor;
        } catch {
            return Main.layoutManager.primaryMonitor ?? null;
        }
    }

    _logSkipOnce(name, actor, reason) {
        const signature = `${name}:${actorSignature(actor)}:${reason}`;
        if (this._skip_log.has(signature))
            return;

        this._skip_log.add(signature);
        if (this.settings.DEBUG)
            console.log(`[Blur my Shell > overlays]   skipping ${name} (${actorSignature(actor)}): ${reason}`);
    }

    _log(message) {
        if (this.settings.DEBUG)
            console.log(`[Blur my Shell > overlays]   ${message}`);
    }

    _warn(message) {
        console.warn(`[Blur my Shell > overlays]   ${message}`);
    }
};
