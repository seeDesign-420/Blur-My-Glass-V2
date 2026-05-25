import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { Pipeline } from '../conveniences/pipeline.js';
import { DummyPipeline } from '../conveniences/dummy_pipeline.js';

const MAX_RETRIES = 10;
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
});

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

function resolveTargetActor(actor) {
    return actor;
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

function resolvePopupMenu(actor) {
    const boxPointer = resolveBoxPointer(actor);
    return actor?._delegate ?? boxPointer?._delegate ?? null;
}

function resolvePopupVisualActor(actor) {
    const popupMenu = resolvePopupMenu(actor);
    if (popupMenu?.box)
        return popupMenu.box;

    const boxPointer = resolveBoxPointer(actor);
    if (boxPointer?.bin?.get_child) {
        const child = boxPointer.bin.get_child();
        if (child)
            return child;
    }

    if (boxPointer?.bin)
        return boxPointer.bin;
    if (boxPointer?._bin)
        return boxPointer._bin;

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

    const visualActor = resolvePopupVisualActor(actor);
    if (visualActor)
        return visualActor;

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

function resolveAnchorActor(actor, targetActor) {
    const boxPointer = resolveBoxPointer(actor);
    if (boxPointer && resolvePopupVisualActor(actor) === targetActor)
        return boxPointer;

    return targetActor;
}

function getOverlayTuning(descriptor) {
    return TARGET_TUNING[descriptor.name] ?? {};
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

const TARGET_DEFINITIONS = [
    {
        name: 'date-menu',
        setting: 'DATE_MENU',
        getActors: () => [Main.panel?.statusArea?.dateMenu?.menu?.actor].filter(Boolean),
        match: actor => actor === Main.panel?.statusArea?.dateMenu?.menu?.actor,
        resolveTarget: resolvePopupContentActor,
        tuning: getOverlayTuning({name: 'date-menu'}),
    },
    {
        name: 'quick-settings',
        setting: 'QUICK_SETTINGS',
        getActors: () => [Main.panel?.statusArea?.quickSettings?.menu?.actor].filter(Boolean),
        match: actor => actor === Main.panel?.statusArea?.quickSettings?.menu?.actor,
        resolveTarget: resolvePopupContentActor,
        tuning: getOverlayTuning({name: 'quick-settings'}),
    },
    {
        name: 'notifications',
        setting: 'NOTIFICATIONS',
        getActors: () => [
            Main.messageTray?._bannerBin,
            Main.panel?.statusArea?.dateMenu?._messageList,
        ].filter(Boolean),
        match: actor => actor === Main.messageTray?._bannerBin ||
            actor === Main.panel?.statusArea?.dateMenu?._messageList,
        tuning: getOverlayTuning({name: 'notifications'}),
    },
    {
        name: 'osd',
        setting: 'OSD',
        getActors: () => (Main.osdWindowManager?._osdWindows ?? [])
            .map(window => window?._hbox)
            .filter(Boolean),
        match: actor => actor.get_style_class_name?.()?.includes('osd-window') ?? false,
        tuning: getOverlayTuning({name: 'osd'}),
    },
    {
        name: 'desktop-menus',
        setting: 'DESKTOP_MENUS',
        getActors: () => [Main.uiGroup, global.stage].filter(Boolean),
        match: actor => {
            const styleClass = actor.get_style_class_name?.() ?? '';
            return styleClass.includes('background-menu');
        },
        resolveTarget: resolvePopupContentActor,
        tuning: getOverlayTuning({name: 'desktop-menus'}),
    },
    {
        name: 'app-menus',
        setting: 'APP_MENUS',
        getActors: () => [Main.uiGroup, global.stage].filter(Boolean),
        match: actor => {
            const styleClass = actor.get_style_class_name?.() ?? '';
            return styleClass.includes('window-menu') || styleClass.includes('app-menu');
        },
        resolveTarget: resolvePopupContentActor,
        tuning: getOverlayTuning({name: 'app-menus'}),
    },
];

class OverlayTargetState {
    constructor(manager, descriptor, actor) {
        this.manager = manager;
        this.descriptor = descriptor;
        this.actor = actor;
        this.target_actor = descriptor.resolveTarget?.(actor) ?? resolveTargetActor(actor);
        this.anchor_actor = resolveAnchorActor(actor, this.target_actor);
        this.background_group = null;
        this.background_actor = null;
        this.bg_manager = null;
        this.retry_id = 0;
        this.retry_count = 0;
        this.attached = false;
        this.disposed = false;
        this._signal_ids = [];
        this._parent_signal_ids = [];
        this._parent = null;

        this._connectLifecycleSignals();
    }

    _connectLifecycleSignals() {
        const actors = new Set([
            this.actor,
            this.target_actor,
            this.anchor_actor,
        ].filter(Boolean));

        for (const actor of actors) {
            this._connect(actor, 'notify::visible', () => this.sync());
            this._connect(actor, 'notify::mapped', () => this.sync());
            this._connect(actor, 'notify::parent', () => this._onParentChanged());
            this._connect(actor, 'destroy', () => this.dispose());

            for (const signal of GEOMETRY_SIGNALS)
                this._connect(actor, signal, () => this.syncGeometry());
        }
    }

    _connect(actor, signal, callback) {
        try {
            const id = actor.connect(signal, callback);
            this._signal_ids.push([actor, id]);
            return id;
        } catch (e) {
            this.manager._logSkipOnce(
                this.descriptor.name,
                actor,
                `could not connect ${signal}: ${e}`
            );
            return 0;
        }
    }

    _disconnectAll(list) {
        for (const [actor, id] of list) {
            if (!id)
                continue;

            try {
                actor.disconnect(id);
            } catch {
                // Actor may already be destroyed. Ignore and continue.
            }
        }
        list.length = 0;
    }

    _onParentChanged() {
        if (this.attached)
            this.detach();

        this._updateParentSignals();
        this.sync();
    }

    _updateParentSignals() {
        this._disconnectAll(this._parent_signal_ids);

        this._parent = this._getAttachment()?.parent ?? null;
        if (!this._parent)
            return;

        for (const signal of [
            'notify::x',
            'notify::y',
            'notify::width',
            'notify::height',
            'notify::scale-x',
            'notify::scale-y',
            'notify::translation-x',
            'notify::translation-y',
            'notify::pivot-point',
            'notify::visible',
            'notify::mapped',
        ]) {
            this._connectParent(signal, () => this.syncGeometry());
        }
    }

    _getAttachment() {
        const sibling = this.anchor_actor ?? this.target_actor;
        const parent = sibling?.get_parent?.() ?? null;

        if (!parent || !sibling)
            return null;

        return { parent, sibling };
    }

    _connectParent(signal, callback) {
        if (!this._parent)
            return;

        try {
            const id = this._parent.connect(signal, callback);
            this._parent_signal_ids.push([this._parent, id]);
        } catch (e) {
            this.manager._logSkipOnce(
                this.descriptor.name,
                this._parent,
                `could not connect ${signal}: ${e}`
            );
        }
    }

    isEnabled() {
        return this.manager._isTargetEnabled(this.descriptor);
    }

    isReady() {
        if (!this.target_actor)
            return false;

        const attachment = this._getAttachment();
        if (!attachment)
            return false;

        if (!this.target_actor.visible || !this.target_actor.mapped)
            return false;

        return isPositiveSize(this.target_actor);
    }

    sync() {
        if (this.disposed)
            return;

        if (!this.isEnabled()) {
            this.detach();
            return;
        }

        if (!this._getAttachment()) {
            this.detach();
            this._scheduleRetry();
            return;
        }

        if (!this.target_actor.visible || !this.target_actor.mapped) {
            this.detach();
            this.retry_count = 0;
            return;
        }

        if (!isPositiveSize(this.target_actor)) {
            this.detach();
            this._scheduleRetry();
            return;
        }

        if (!this.attached) {
            this.attach();
            return;
        }

        this.syncGeometry();
    }

    _scheduleRetry() {
        if (this.retry_id)
            return;

        if (this.retry_count >= MAX_RETRIES) {
            this.manager._logSkipOnce(
                this.descriptor.name,
                this.actor,
                'timed out waiting for a stable allocation'
            );
            return;
        }

        const delay = Math.min(250, 16 * (this.retry_count + 1));
        this.retry_count += 1;
        this.retry_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
            this.retry_id = 0;
            if (this.disposed)
                return GLib.SOURCE_REMOVE;

            if (this.isEnabled())
                this.sync();

            return GLib.SOURCE_REMOVE;
        });
        GLib.Source.set_name_by_id(this.retry_id, `[blur-my-shell] overlays retry ${this.descriptor.name}`);
    }

    attach() {
        if (this.attached || this.disposed)
            return;

        const attachment = this._getAttachment();
        if (!attachment)
            return;

        const monitor = this.manager._findMonitorForActor(this.target_actor);
        if (!monitor) {
            this._scheduleRetry();
            return;
        }

        try {
            this._createBackground(monitor.index);
            attachment.parent.insert_child_below(this.background_group, attachment.sibling);
            this._updateParentSignals();
            this.attached = true;
            this.retry_count = 0;
            this.syncGeometry();
        } catch (e) {
            this.manager._logSkipOnce(
                this.descriptor.name,
                this.actor,
                `failed to attach: ${e}`
            );
            this._destroyBackground();
            this._scheduleRetry();
        }
    }

    _createBackground(monitorIndex) {
        this.background_group = new Meta.BackgroundGroup({
            name: `bms-overlay-${this.descriptor.name}-backgroundgroup`,
            width: 0,
            height: 0,
        });

        if (this.manager.settings.overlays.STATIC_BLUR) {
            const background_managers = [];
            const pipeline = new Pipeline(
                this.manager.effects_manager,
                global.blur_my_shell._pipelines_manager,
                this.manager.settings.overlays.PIPELINE
            );
            this.background_actor = pipeline.create_background_with_effects(
                monitorIndex,
                background_managers,
                this.background_group,
                `bms-overlay-${this.descriptor.name}-blurred-widget`,
                false
            );
            this.bg_manager = background_managers[0] ?? null;
        } else {
            const pipeline = new DummyPipeline(
                this.manager.effects_manager,
                this.manager.settings.overlays,
                null,
                getOverlayTuning(this.descriptor)
            );
            [this.background_actor, this.bg_manager] = pipeline.create_background_with_effect(
                this.background_group,
                `bms-overlay-${this.descriptor.name}-blurred-widget`
            );
        }
    }

    detach() {
        if (!this.attached)
            return;

        this.attached = false;
        this._destroyBackground();
    }

    _destroyBackground() {
        if (this.retry_id) {
            GLib.source_remove(this.retry_id);
            this.retry_id = 0;
        }

        if (this.bg_manager?._bms_pipeline) {
            try {
                this.bg_manager._bms_pipeline.destroy();
            } catch (e) {
                this.manager._warn(`failed to destroy pipeline for ${this.descriptor.name}: ${e}`);
            }
        }

        try {
            this.bg_manager?.destroy?.();
        } catch (e) {
            this.manager._warn(`failed to destroy helper actor for ${this.descriptor.name}: ${e}`);
        }

        try {
            this.background_group?.destroy?.();
        } catch (e) {
            this.manager._warn(`failed to destroy background group for ${this.descriptor.name}: ${e}`);
        }

        this.background_group = null;
        this.background_actor = null;
        this.bg_manager = null;
    }

    syncGeometry() {
        if (!this.attached || this.disposed || !this.background_actor)
            return;

        const target = this.target_actor;
        const attachment = this._getAttachment();
        const parent = attachment?.parent ?? null;
        if (!parent)
            return;

        const monitor = this.manager._findMonitorForActor(target);
        if (!monitor)
            return;

        const [stageX, stageY] = getTransformPosition(target);
        let [stageWidth, stageHeight] = getTransformSize(target);
        if (stageWidth <= 0 || stageHeight <= 0) {
            stageWidth = target.width ?? target.get_width?.() ?? 1;
            stageHeight = target.height ?? target.get_height?.() ?? 1;
        }
        const targetRect = stageRectToActorSpace(
            parent,
            stageX,
            stageY,
            stageWidth,
            stageHeight
        );
        const localX = Math.round(targetRect.x);
        const localY = Math.round(targetRect.y);
        const localWidth = Math.max(1, Math.round(targetRect.width));
        const localHeight = Math.max(1, Math.round(targetRect.height));

        try {
            if (this.manager.settings.overlays.STATIC_BLUR) {
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
                this.background_actor.set_clip(
                    0,
                    0,
                    localWidth,
                    localHeight
                );
            }

            this.background_actor.show?.();
            this.bg_manager?._bms_pipeline?.repaint_effect?.();
        } catch (e) {
            this.manager._logSkipOnce(
                this.descriptor.name,
                this.actor,
                `failed to sync geometry: ${e}`
            );
            this.detach();
            this._scheduleRetry();
        }
    }

    rebuild() {
        if (this.disposed)
            return;

        const wasAttached = this.attached;
        this.detach();
        if (wasAttached)
            this.sync();
    }

    dispose() {
        if (this.disposed)
            return;

        this.disposed = true;
        this.detach();
        this._disconnectAll(this._signal_ids);
        this._disconnectAll(this._parent_signal_ids);
        this.manager._removeState(this);
    }
}

export const OverlaysBlur = class OverlaysBlur {
    constructor(connections, settings, effects_manager) {
        this.connections = connections;
        this.settings = settings;
        this.effects_manager = effects_manager;
        this.enabled = false;
        this._states = new Map();
        this._skip_log = new Set();
        this._refresh_source_id = 0;
    }

    enable() {
        if (this.enabled)
            return;

        this._log('enabling overlay blur');
        this.enabled = true;

        this.connections.connect(Main.uiGroup, 'child-added', (_group, actor) => {
            if (!isManagedOverlayActor(actor))
                this._queueRefresh();
        });
        this.connections.connect(Main.uiGroup, 'child-removed', (_group, actor) => {
            if (!isManagedOverlayActor(actor))
                this._queueRefresh();
        });
        this.connections.connect(global.stage, 'child-added', (_group, actor) => {
            if (!isManagedOverlayActor(actor))
                this._queueRefresh();
        });
        this.connections.connect(global.stage, 'child-removed', (_group, actor) => {
            if (!isManagedOverlayActor(actor))
                this._queueRefresh();
        });
        this.connections.connect(Main.layoutManager, 'monitors-changed', () => {
            this._queueRefresh();
        });

        this.syncTargets(true);
    }

    disable() {
        if (!this.enabled)
            return;

        this._log('disabling overlay blur');

        for (const state of [...this._states.values()])
            state.dispose();

        this._states.clear();
        this._skip_log.clear();
        if (this._refresh_source_id) {
            GLib.source_remove(this._refresh_source_id);
            this._refresh_source_id = 0;
        }
        this.connections.disconnect_all();
        this.enabled = false;
    }

    syncTargets(rebuildAttached = false) {
        if (!this.enabled)
            return;

        for (const descriptor of TARGET_DEFINITIONS) {
            if (!this._isTargetEnabled(descriptor)) {
                this._disposeDescriptorStates(descriptor);
                continue;
            }

            const matchedActors = new Set(this._collectActors(descriptor));

            for (const actor of matchedActors) {
                this._ensureState(descriptor, actor);
            }

            for (const state of [...this._states.values()]) {
                if (state.descriptor !== descriptor)
                    continue;

                if (!matchedActors.has(state.actor))
                    state.dispose();
            }
        }

        if (rebuildAttached) {
            for (const state of this._states.values()) {
                if (state.attached)
                    state.rebuild();
            }
        }
    }

    _collectActors(descriptor) {
        const actors = new Set();

        for (const root of descriptor.getActors()) {
            if (!root)
                continue;

            if (descriptor.match(root))
                actors.add(root);

            if (root.get_children) {
                this._walkActorTree(root, actor => {
                    if (descriptor.match(actor))
                        actors.add(actor);
                });
            }
        }

        return [...actors];
    }

    _scanActorTree(actor) {
        if (!actor)
            return;

        for (const descriptor of TARGET_DEFINITIONS) {
            if (!this._isTargetEnabled(descriptor))
                continue;

            if (descriptor.match(actor))
                this._ensureState(descriptor, actor);
        }

        this._walkActorTree(actor, child => {
            for (const descriptor of TARGET_DEFINITIONS) {
                if (!this._isTargetEnabled(descriptor))
                    continue;

                if (descriptor.match(child))
                    this._ensureState(descriptor, child);
            }
        });
    }

    _walkActorTree(actor, callback) {
        const stack = [...(actor?.get_children?.() ?? [])];
        while (stack.length > 0) {
            const child = stack.pop();
            callback(child);

            const children = child?.get_children?.();
            if (children?.length)
                stack.push(...children);
        }
    }

    _ensureState(descriptor, actor) {
        const existingState = this._states.get(actor);
        if (existingState) {
            if (existingState.descriptor !== descriptor) {
                existingState.dispose();
            } else {
                return existingState;
            }
        }

        const state = new OverlayTargetState(this, descriptor, actor);
        this._states.set(actor, state);
        state.sync();
        return state;
    }

    _disposeDescriptorStates(descriptor) {
        for (const state of [...this._states.values()]) {
            if (state.descriptor !== descriptor)
                continue;

            state.dispose();
        }
    }

    _removeState(state) {
        if (this._states.get(state.actor) === state)
            this._states.delete(state.actor);
    }

    _queueRefresh() {
        if (!this.enabled || this._refresh_source_id)
            return;

        this._refresh_source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 32, () => {
            this._refresh_source_id = 0;
            if (this.enabled)
                this.syncTargets(true);
            return GLib.SOURCE_REMOVE;
        });
        GLib.Source.set_name_by_id(this._refresh_source_id, '[blur-my-shell] overlays refresh');
    }

    _logSkipOnce(name, actor, reason) {
        const signature = `${name}:${actorSignature(actor)}:${reason}`;
        if (this._skip_log.has(signature))
            return;

        this._skip_log.add(signature);
        if (this.settings.DEBUG)
            console.log(`[Blur my Shell > overlays]   skipping ${name} (${actorSignature(actor)}): ${reason}`);
    }

    _isTargetEnabled(descriptor) {
        return this.settings.overlays.BLUR && this.settings.overlays[descriptor.setting];
    }

    _findMonitorForActor(actor) {
        try {
            return Main.layoutManager.findMonitorForActor(actor) ??
                Main.layoutManager.findMonitorForActor(actor.get_parent?.()) ??
                Main.layoutManager.primaryMonitor;
        } catch {
            return Main.layoutManager.primaryMonitor ?? null;
        }
    }

    _log(message) {
        if (this.settings.DEBUG)
            console.log(`[Blur my Shell > overlays]   ${message}`);
    }

    _warn(message) {
        console.warn(`[Blur my Shell > overlays]   ${message}`);
    }
};
