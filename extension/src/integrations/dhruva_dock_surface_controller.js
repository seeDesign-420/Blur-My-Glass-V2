import Meta from 'gi://Meta';

import { DynamicBlurPipeline } from '../blur/dynamic_blur_pipeline.js';
import { DisposableStore } from '../runtime/disposable_store.js';
import { BlurGeometryTracker } from '../runtime/blur_geometry_tracker.js';

export class DhruvaDockSurfaceController {
    constructor(effects_manager, settings) {
        this.effects_manager = effects_manager;
        this.settings = settings;
    }

    attach(container, bgActor) {
        let parent = container.get_parent();
        if (!parent || !bgActor)
            return null;

        let background_group = new Meta.BackgroundGroup({
            name: 'bms-dhruva-bg-group',
            width: 0,
            height: 0,
        });

        const pipeline = new DynamicBlurPipeline(this.effects_manager, this.settings.dhruva);
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

                const nextX = Math.round(local_x);
                const nextY = Math.round(local_y);
                const nextW = Math.round(tw);
                const nextH = Math.round(th);

                if (background_group.x !== nextX || background_group.y !== nextY)
                    background_group.set_position(nextX, nextY);
                if (background_group.width !== nextW || background_group.height !== nextH)
                    background_group.set_size(nextW, nextH);
                if (blurWidget.width !== nextW || blurWidget.height !== nextH)
                    blurWidget.set_size(nextW, nextH);
                blurWidget.set_position(0, 0);
                blurWidget.set_clip(0, 0, nextW, nextH);
                bgManager?._bms_pipeline?.effect?.queue_repaint?.();
            } catch {
                // Dhruva can briefly unmap/reparent actors during auto-hide.
            }
        };

        let disposables = new DisposableStore();
        const tracker = new BlurGeometryTracker(disposables, sync_geometry);
        tracker.watchActor(bgActor);
        tracker.watchActor(container);
        disposables.addCleanup(() => tracker.dispose());

        const sync_visibility = () => {
            if (container.visible && bgActor.visible)
                background_group.show();
            else
                background_group.hide();
        };
        disposables.addSignal(bgActor, 'notify::visible', sync_visibility);
        disposables.addSignal(container, 'notify::visible', sync_visibility);
        sync_visibility();
        tracker.queueSync();

        return { background_group, blurWidget, bgManager, disposables };
    }
}
