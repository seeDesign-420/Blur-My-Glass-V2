import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import { Pipeline } from '../conveniences/pipeline.js';
import { DynamicBlurPipeline } from '../conveniences/dummy_pipeline.js';
import { DisposableStore } from '../runtime/disposable_store.js';
import { BlurGeometryTracker } from '../runtime/blur_geometry_tracker.js';
import {
    GEOMETRY_SIGNALS,
    OPEN_ANIMATION_DURATION_MS,
    CLOSE_ANIMATION_DURATION_MS,
    getOverlayTuning,
} from './constants.js';
import {
    isPositiveSize,
    getTransformPosition,
    getTransformSize,
    stageRectToActorSpace,
} from './geometry.js';

export class OverlaySurfaceController {
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

        this._signals = new DisposableStore();
        this._parentSignals = new DisposableStore();
        this._close_source_id = 0;
        this._open_source_id = 0;
        this._shown = false;
        this.destroyed = false;
        this._geometryDisposables = new DisposableStore();
        this._geometryTracker = new BlurGeometryTracker(this._geometryDisposables, () => this.syncGeometry());
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
            this._connect(actor, signal, () => this._geometryTracker.queueSync());
    }

    _connect(actor, signal, callback) {
        try {
            this._signals.addSignal(actor, signal, callback);
        } catch (e) {
            this.runtime._logSkipOnce(this.target, actor, `could not connect ${signal}: ${e}`);
        }
    }

    _connectParent(parent) {
        if (!parent)
            return;

        this._parentSignals.dispose();
        this._parentSignals = new DisposableStore();
        for (const signal of GEOMETRY_SIGNALS)
            this._connectParentSignal(parent, signal, () => this._geometryTracker.queueSync());
        this._connectParentSignal(parent, 'notify::visible', () => this.sync());
        this._connectParentSignal(parent, 'notify::mapped', () => this.sync());
    }

    _connectParentSignal(parent, signal, callback) {
        try {
            this._parentSignals.addSignal(parent, signal, callback);
        } catch (e) {
            this.runtime._logSkipOnce(this.target, parent, `could not connect ${signal}: ${e}`);
        }
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
            this._geometryTracker.queueSync();
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
        this._geometryTracker.queueSync();
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
        this._parentSignals.dispose();
        this._parentSignals = new DisposableStore();

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
            const pipeline = new DynamicBlurPipeline(
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
        this._geometryTracker.dispose();
        this._geometryDisposables.dispose();
        this._cancelTimers();
        this.hide();
        this._signals.dispose();
        this._parentSignals.dispose();
    }
}
