import { DynamicBlurPipeline } from '../blur/dynamic_blur_pipeline.js';
import { DisposableStore } from '../runtime/disposable_store.js';
import { BlurGeometryTracker } from '../runtime/blur_geometry_tracker.js';
import { GEOMETRY_SIGNALS, getOverlayTuning } from './constants.js';
import {
    getTransformPosition,
    getTransformSize,
    hasPositiveTransformedSize,
    snapRectOutwards,
    stageRectToActorSpace,
} from './geometry.js';

export class QuickSettingsControlBlurSurface {
    constructor(runtime, layer, actor, boundsActor, shape, id) {
        this.runtime = runtime;
        this.layer = layer;
        this.actor = actor;
        this.boundsActor = boundsActor ?? actor;
        this.shape = shape;
        this.id = id;
        this._disposables = new DisposableStore();
        this._surfaceActor = null;
        this._bg_manager = null;
        this._maskEffect = null;
        this._shown = false;
        this.destroyed = false;
        this._lastRect = null;
        this._lastMaskState = null;
        this._geometryTracker = new BlurGeometryTracker(this._disposables, () => this.syncGeometry());
    }

    enable() {
        if (this.destroyed || !this.actor)
            return;

        this._connectLifecycle(this.actor, false);
        if (this.boundsActor !== this.actor)
            this._connectLifecycle(this.boundsActor, true);
        this.sync();
    }

    _connectLifecycle(actor, isBoundsActor) {
        if (!actor)
            return;

        this._connect(actor, 'destroy', () => {
            if (isBoundsActor)
                this.layer.queueRefresh();
            else
                this.destroy();
        });
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
        return Boolean(this.actor?.visible && this.actor?.mapped && this.boundsActor?.visible &&
            this.boundsActor?.mapped && hasPositiveTransformedSize(this.boundsActor));
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
            this._surfaceActor.clip_to_allocation = true;
            this._surfaceActor.set_clip(0, 0, 1, 1);
            this.runtime._perfCount('blur_surfaces.created');
            this.runtime._perfCount('blur_effects.created');

            this._maskEffect = this.runtime.effects_manager.new_corner_effect({
                radius: 0,
                corners_top: true,
                corners_bottom: true,
            });
            this._surfaceActor.add_effect(this._maskEffect);
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
            if (this._maskEffect)
                this.runtime.effects_manager.remove(this._maskEffect);
        } catch {
            // Ignore mask teardown errors.
        }

        try {
            this._surfaceActor?.destroy?.();
        } catch {
            // Ignore actor teardown errors.
        }

        this._surfaceActor = null;
        this._bg_manager = null;
        this._maskEffect = null;
        this._lastRect = null;
        this._lastMaskState = null;
    }

    sync() {
        if (this.destroyed)
            return;

        if (!this.layer.isOpen() || !this.actor)
            return;
        if (this.runtime.isOverlayWorkSuspended() && !this._shown) {
            this.runtime._perfCount('surfaces.create_blocked_suspended');
            return;
        }

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

        const targetActor = this.boundsActor ?? this.actor;
        const [stageX, stageY] = getTransformPosition(targetActor);
        let [stageWidth, stageHeight] = getTransformSize(targetActor);
        if (stageWidth <= 0 || stageHeight <= 0) {
            stageWidth = targetActor.width ?? targetActor.get_width?.() ?? 1;
            stageHeight = targetActor.height ?? targetActor.get_height?.() ?? 1;
        }

        const nextRect = snapRectOutwards(stageRectToActorSpace(parent, stageX, stageY, stageWidth, stageHeight));
        if (!nextRect)
            return;

        const { x: localX, y: localY, width: localWidth, height: localHeight } = nextRect;
        const nextMaskState = this._resolveMaskState(localWidth, localHeight);

        if (this._lastRect &&
            this._lastRect.x === nextRect.x &&
            this._lastRect.y === nextRect.y &&
            this._lastRect.width === nextRect.width &&
            this._lastRect.height === nextRect.height &&
            this._lastMaskState &&
            this._lastMaskState.radius === nextMaskState.radius &&
            this._lastMaskState.corners_top === nextMaskState.corners_top &&
            this._lastMaskState.corners_bottom === nextMaskState.corners_bottom) {
            this.runtime._perfCount('geometry.sync_skipped');
            return;
        }

        try {
            this._lastRect = nextRect;
            this._surfaceActor.x = localX;
            this._surfaceActor.y = localY;
            this._surfaceActor.width = localWidth;
            this._surfaceActor.height = localHeight;
            this._surfaceActor.clip_to_allocation = true;
            this._surfaceActor.set_clip(0, 0, localWidth, localHeight);

            const pipeline = this._bg_manager?._bms_pipeline;
            pipeline?.set_corner_radius?.(nextMaskState.radius);

            if (this._maskEffect)
                this._maskEffect.set(nextMaskState);

            this._lastMaskState = nextMaskState;
            this._bg_manager?._bms_pipeline?.repaint_effect?.();
            this.runtime._perfCount('geometry.sync_applied');
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

    _resolveMaskState(width, height) {
        const maxRadius = Math.max(0, Math.min(width, height) / 2);
        const overlayRadius = Math.max(0, this.runtime.settings.overlays.CORNER_RADIUS ?? 0);
        const radius = this.shape === 'circle' ? maxRadius : Math.min(overlayRadius, maxRadius);
        return {
            radius,
            corners_top: true,
            corners_bottom: true,
        };
    }
}
