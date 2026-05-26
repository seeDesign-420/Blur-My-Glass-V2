import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

import { DynamicBlurPipeline } from '../blur/dynamic_blur_pipeline.js';
import { DisposableStore } from '../runtime/disposable_store.js';
import { BlurGeometryTracker } from '../runtime/blur_geometry_tracker.js';

export class DhruvaContextMenuSurfaceController {
    constructor(effects_manager, settings, resolver) {
        this.effects_manager = effects_manager;
        this.settings = settings;
        this.resolver = resolver;
    }

    createState(overlay) {
        let { menuContainer, panel, bgDrawingArea } = this.resolver.findContextMenuParts(overlay);
        if (!menuContainer || !panel)
            return null;

        return {
            overlay,
            menuContainer,
            panel,
            bgDrawingArea,
            blurWidget: null,
            bgManager: null,
            tracker: null,
            disposables: new DisposableStore(),
        };
    }

    scheduleAttach(state, onDestroyed) {
        const { overlay, panel } = state;
        state.disposables.addSignal(overlay, 'destroy', onDestroyed);

        const inject = () => this._inject(state);
        state.disposables.addSignal(panel, 'notify::allocation', inject);
        state.disposables.addSource(GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            inject();
            return GLib.SOURCE_REMOVE;
        }));
    }

    _inject(state) {
        if (state.blurWidget)
            return;

        let { menuContainer, panel, bgDrawingArea } = state;
        let alloc = panel.get_allocation_box();
        if (alloc.get_width() <= 0 || alloc.get_height() <= 0)
            return;

        const pipeline = new DynamicBlurPipeline(this.effects_manager, this.settings.dhruva);
        let [blurWidget, bgManager] = pipeline.create_background_with_effect(
            menuContainer, 'bms-dhruva-menu-blurred-widget'
        );

        const sync_geometry = () => {
            let currentAlloc = panel.get_allocation_box();
            let w = currentAlloc.get_width();
            let h = currentAlloc.get_height();
            if (w <= 0 || h <= 0)
                return;

            const nextX = currentAlloc.get_x();
            const nextY = currentAlloc.get_y();
            if (blurWidget.x !== nextX || blurWidget.y !== nextY)
                blurWidget.set_position(nextX, nextY);
            if (blurWidget.width !== w || blurWidget.height !== h)
                blurWidget.set_size(w, h);
            bgManager?._bms_pipeline?.effect?.queue_repaint?.();
        };

        state.tracker = new BlurGeometryTracker(state.disposables, sync_geometry);
        state.tracker.watchActor(panel);
        state.tracker.queueSync();

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

        state.blurWidget = blurWidget;
        state.bgManager = bgManager;
    }
}
