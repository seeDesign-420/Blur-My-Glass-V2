import { DynamicBlurPipeline } from '../conveniences/dummy_pipeline.js';
import { DisposableStore } from '../runtime/disposable_store.js';
import { BlurGeometryTracker } from '../runtime/blur_geometry_tracker.js';
import { GEOMETRY_SIGNALS, getOverlayTuning } from './constants.js';
import {
    getTransformPosition,
    getTransformSize,
    hasPositiveTransformedSize,
    stageRectToActorSpace,
} from './geometry.js';

export class QuickSettingsControlBlurSurface {
    constructor(runtime, layer, actor, shape, id) {
        this.runtime = runtime;
        this.layer = layer;
        this.actor = actor;
        this.shape = shape;
        this.id = id;
        this._disposables = new DisposableStore();
        this._surfaceActor = null;
        this._bg_manager = null;
        this._shown = false;
        this.destroyed = false;
        this._geometryTracker = new BlurGeometryTracker(this._disposables, () => this.syncGeometry());
    }

    enable() {
        if (this.destroyed || !this.actor)
            return;

        this._connectLifecycle(this.actor);
        this.sync();
    }

    _connectLifecycle(actor) {
        if (!actor)
            return;

        this._connect(actor, 'destroy', () => this.destroy());
        this._connect(actor, 'notify::visible', () => this.layer.queueRefresh());
        this._connect(actor, 'notify::mapped', () => this.layer.queueRefresh());

        for (const signal of GEOMETRY_SIGNALS)
            this._connect(actor, signal, () => this._geometryTracker.queueSync());
    }

    _connect(actor, signal, callback) {
        try {
            this._disposables.addSignal(actor, signal, callback);
        } catch (e) {
            this.runtime._logSkipOnce('quick-settings', actor, `could not connect ${signal}: ${e}`);
        }
    }

    _isReadyForOpen() {
        return Boolean(this.actor?.visible && this.actor?.mapped && hasPositiveTransformedSize(this.actor));
    }

    _ensureSurface() {
        if (this._surfaceActor)
            return true;

        const layerActor = this.layer._overlayContainer;
        if (!layerActor)
            return false;

        const pipeline = new DynamicBlurPipeline(
            this.runtime.effects_manager,
            this.runtime.settings.overlays,
            null,
            { ...getOverlayTuning('quick-settings') }
        );
        const name = `bms-overlay-quick-settings-${this.id}-blurred-widget`;
        [this._surfaceActor, this._bg_manager] = pipeline.create_background_with_effect(layerActor, name);
        if (this._surfaceActor) {
            this._surfaceActor.reactive = false;
            this._surfaceActor.can_focus = false;
            this._surfaceActor.track_hover = false;
        }
        return Boolean(this._surfaceActor);
    }

    _destroySurface() {
        this._shown = false;

        if (this._bg_manager?._bms_pipeline) {
            try {
                this._bg_manager._bms_pipeline.destroy();
            } catch {
                // Ignore pipeline teardown errors.
            }
        }

        try {
            this._bg_manager?.destroy?.();
        } catch {
            // Ignore helper teardown errors.
        }

        try {
            this._surfaceActor?.destroy?.();
        } catch {
            // Ignore actor teardown errors.
        }

        this._surfaceActor = null;
        this._bg_manager = null;
    }

    sync() {
        if (this.destroyed)
            return;

        if (!this.layer.isOpen() || !this.actor)
            return;

        if (!this._isReadyForOpen()) {
            this._destroySurface();
            return;
        }

        if (!this._ensureSurface())
            return;

        this._shown = true;
        this._geometryTracker.queueSync();
    }

    syncGeometry() {
        if (this.destroyed || !this._shown || !this._surfaceActor || !this.actor)
            return;

        const parent = this.layer.getOverlayParent();
        if (!parent)
            return;

        const [stageX, stageY] = getTransformPosition(this.actor);
        let [stageWidth, stageHeight] = getTransformSize(this.actor);
        if (stageWidth <= 0 || stageHeight <= 0) {
            stageWidth = this.actor.width ?? this.actor.get_width?.() ?? 1;
            stageHeight = this.actor.height ?? this.actor.get_height?.() ?? 1;
        }

        const targetRect = stageRectToActorSpace(parent, stageX, stageY, stageWidth, stageHeight);
        const localX = Math.round(targetRect.x);
        const localY = Math.round(targetRect.y);
        const localWidth = Math.max(1, Math.round(targetRect.width));
        const localHeight = Math.max(1, Math.round(targetRect.height));

        try {
            this._surfaceActor.x = localX;
            this._surfaceActor.y = localY;
            this._surfaceActor.width = localWidth;
            this._surfaceActor.height = localHeight;
            this._surfaceActor.clip_to_allocation = true;
            this._surfaceActor.set_clip(0, 0, localWidth, localHeight);

            if (this.shape === 'circle') {
                const radius = Math.max(0, Math.min(localWidth, localHeight) / 2);
                const pipeline = this._bg_manager?._bms_pipeline;
                if (pipeline) {
                    pipeline.effect_overrides.corner_radius = radius;
                    if (pipeline.effect)
                        pipeline.effect.unscaled_corner_radius = radius;
                }
            }

            this._bg_manager?._bms_pipeline?.repaint_effect?.();
        } catch (e) {
            this.runtime._logSkipOnce('quick-settings', this.actor, `geometry sync failed: ${e}`);
            this._destroySurface();
        }
    }

    destroy() {
        if (this.destroyed)
            return;

        this.destroyed = true;
        this._geometryTracker.dispose();
        this._disposables.dispose();
        this._destroySurface();
    }
}
