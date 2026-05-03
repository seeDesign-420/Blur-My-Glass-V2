import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { DummyPipeline } from '../conveniences/dummy_pipeline.js';


/// Manages blur effects for the Dhruva dock extension.
///
/// Dhruva creates its dock as:
///   DhruvaContainer (Clutter.Actor, chrome)
///     ├── DhruvaBackground (St.Widget) — blur target
///     └── Dhruva (St.BoxLayout) — icon container
///
/// This component discovers Dhruva dock actors at runtime by walking
/// chrome actors and injects DummyPipeline blur behind DhruvaBackground.
export const DhruvaBlur = class DhruvaBlur {
    constructor(connections, settings, effects_manager) {
        this.connections = connections;
        this.settings = settings;
        this.effects_manager = effects_manager;
        this.enabled = false;

        // track blurred docks: Map<DhruvaContainer actor, blur info>
        this._blurred_docks = new Map();

        // track blurred context menus: Map<overlay actor, blur info>
        this._blurred_menus = new Map();

        // re-scan timer IDs
        this._scan_timer_ids = [];
    }

    enable() {
        this._log("enabling dhruva blur...");

        // monitor uiGroup for new chrome actors (Dhruva adds its container there)
        this.connections.connect(Main.uiGroup, 'child-added', (_, actor) => {
            if (actor.get_name() === 'DhruvaContainer')
                this._blur_dock(actor);
            // context menu overlay detection
            if (actor.get_style_class_name &&
                actor.get_style_class_name()?.includes('context-menu-overlay'))
                this._blur_context_menu(actor);
        });

        this.connections.connect(Main.uiGroup, 'child-removed', (_, actor) => {
            if (this._blurred_docks.has(actor))
                this._unblur_dock(actor);
            if (this._blurred_menus.has(actor))
                this._unblur_context_menu(actor);
        });

        // also monitor global stage (Dhruva uses addChrome which adds to stage)
        this.connections.connect(global.stage, 'child-added', (_, actor) => {
            if (actor.get_name() === 'DhruvaContainer')
                this._blur_dock(actor);
            if (actor.get_style_class_name &&
                actor.get_style_class_name()?.includes('context-menu-overlay'))
                this._blur_context_menu(actor);
        });

        // initial scan for existing docks
        this._scan_for_docks();

        // delayed re-scans to handle extension load order races
        // Dhruva may enable after blur-my-shell
        for (let delay of [500, 2000, 5000, 10000]) {
            let id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                this._scan_timer_ids = this._scan_timer_ids.filter(t => t !== id);
                this._scan_for_docks();
                return GLib.SOURCE_REMOVE;
            });
            this._scan_timer_ids.push(id);
        }

        this.enabled = true;
        this._log("dhruva blur enabled.");
    }

    disable() {
        this._log("disabling dhruva blur...");

        // remove all dock blurs (collect keys first to avoid mutation during iteration)
        let dock_containers = [...this._blurred_docks.keys()];
        for (let container of dock_containers) {
            this._unblur_dock(container);
        }
        this._blurred_docks.clear();

        // remove all menu blurs
        let menu_overlays = [...this._blurred_menus.keys()];
        for (let overlay of menu_overlays) {
            this._unblur_context_menu(overlay);
        }
        this._blurred_menus.clear();

        // cancel pending timers
        for (let id of this._scan_timer_ids) {
            GLib.source_remove(id);
        }
        this._scan_timer_ids = [];

        this.connections.disconnect_all();

        this.enabled = false;
        this._log("dhruva blur disabled.");
    }

    /// Scan all stage/uiGroup children for DhruvaContainer actors
    _scan_for_docks() {
        this._log("scanning for Dhruva docks...");

        let found = 0;

        // check both uiGroup and stage children
        const scan_children = (parent) => {
            let children = parent.get_children();
            for (let child of children) {
                if (child.get_name() === 'DhruvaContainer' &&
                    !this._blurred_docks.has(child)) {
                    this._blur_dock(child);
                    found++;
                }
            }
        };

        scan_children(Main.uiGroup);
        scan_children(global.stage);

        this._log(`scan complete, found ${found} new dock(s), total tracked: ${this._blurred_docks.size}`);
    }

    /// Inject blur behind a DhruvaContainer's DhruvaBackground actor.
    ///
    /// Uses the proven BoxPointer pattern:
    ///   wrapper (St.Widget, reactive:false)
    ///     └── background_group (Meta.BackgroundGroup)
    ///           └── blurWidget (St.Widget + NativeDynamicBlurEffect)
    ///
    /// The wrapper is inserted as a sibling of the container in its
    /// parent (uiGroup/stage), positioned below the container in paint
    /// order. The wrapper gets explicit set_position/set_size calls
    /// which provide valid allocation for the entire subtree.
    _blur_dock(container) {
        if (this._blurred_docks.has(container)) return;

        let parent = container.get_parent();
        if (!parent) return;

        this._log(`blurring dock: ${container.get_name()}`);

        // find the background actor
        let bgActor = null;
        let children = container.get_children();
        for (let child of children) {
            if (child.get_name() === 'DhruvaBackground') {
                bgActor = child;
                break;
            }
        }

        if (!bgActor) {
            this._warn("DhruvaBackground not found in container, skipping");
            return;
        }

        // ── Create blur hierarchy (BoxPointer pattern) ──────────────
        //
        // 1. Wrapper St.Widget — provides valid allocation, non-reactive
        // 2. Meta.BackgroundGroup — required container for blur effects
        // 3. blurWidget — St.Widget with NativeDynamicBlurEffect

        let wrapper = new St.Widget({
            name: 'bms-dhruva-blur-wrapper',
            reactive: false,
            can_focus: false,
        });

        let background_group = new Meta.BackgroundGroup({
            name: 'bms-dhruva-bg-group',
        });
        wrapper.add_child(background_group);

        const pipeline = new DummyPipeline(
            this.effects_manager,
            this.settings.dhruva
        );
        let [blurWidget, bgManager] = pipeline.create_background_with_effect(
            background_group, 'bms-dhruva-blurred-widget'
        );

        // Insert wrapper as sibling of container, below it in paint order
        parent.insert_child_below(wrapper, container);

        let signal_ids = [];

        // ── Sync wrapper geometry with bgActor ──────────────────────
        //
        // Dhruva's Magnifier operates entirely via CSS transforms on
        // bgActor (scale_x/y, translation_x/y). We position the wrapper
        // at bgActor's base position (container-relative coords converted
        // to parent-relative) and mirror all transform properties so the
        // blur expands identically during magnification.

        const sync_geometry = () => {
            try {
                // Use get_transformed_position to get bgActor's
                // absolute stage position, then convert to parent's
                // coordinate space.
                let [abs_x, abs_y] = bgActor.get_transformed_position();

                // Convert stage coords to wrapper's parent coordinate space
                let [ok, local_x, local_y] = parent.transform_stage_point(abs_x, abs_y);
                if (!ok) return;

                // get_transformed_size accounts for scale already
                let [tw, th] = bgActor.get_transformed_size();
                if (tw <= 0 || th <= 0) return;

                // Position & size the wrapper
                wrapper.set_position(Math.round(local_x), Math.round(local_y));
                wrapper.set_size(Math.round(tw), Math.round(th));

                // Size the background group and blur widget to match
                background_group.set_size(Math.round(tw), Math.round(th));
                blurWidget.set_position(0, 0);
                blurWidget.set_size(Math.round(tw), Math.round(th));
            } catch (e) {
                // Actor may not be mapped yet
            }

            if (pipeline && pipeline.effect) {
                pipeline.effect.queue_repaint();
            }
        };

        // Track all properties that affect bgActor's visual footprint.
        // This covers both DockUI._updateLayout (x, y, width, height)
        // and Magnifier.applyRealtimeFrame (scale-x/y, translation-x/y).
        for (let prop of [
            'notify::x', 'notify::y',
            'notify::width', 'notify::height',
            'notify::scale-x', 'notify::scale-y',
            'notify::translation-x', 'notify::translation-y',
            'notify::pivot-point',
        ]) {
            signal_ids.push([bgActor, bgActor.connect(prop, sync_geometry)]);
        }

        // Track container-level transforms too (position, scale changes
        // from DockUI, auto-hide animations, etc.)
        for (let prop of [
            'notify::x', 'notify::y',
            'notify::width', 'notify::height',
            'notify::scale-x', 'notify::scale-y',
            'notify::translation-x', 'notify::translation-y',
            'notify::visible',
        ]) {
            signal_ids.push([container, container.connect(prop, sync_geometry)]);
        }

        let visible_id = bgActor.connect('notify::visible', () => {
            if (bgActor.visible)
                wrapper.show();
            else
                wrapper.hide();
        });
        signal_ids.push([bgActor, visible_id]);

        // Hide blur when container is hidden (auto-hide)
        let cont_visible_id = container.connect('notify::visible', () => {
            if (container.visible && bgActor.visible)
                wrapper.show();
            else
                wrapper.hide();
        });
        signal_ids.push([container, cont_visible_id]);

        let destroy_id = container.connect('destroy', () => {
            this._unblur_dock(container);
        });
        signal_ids.push([container, destroy_id]);

        // initial sync
        sync_geometry();

        this._blurred_docks.set(container, {
            bgActor,
            wrapper,
            blurWidget,
            background_group,
            bgManager,
            pipeline,
            signal_ids
        });
    }

    /// Remove blur from a DhruvaContainer
    _unblur_dock(container) {
        let info = this._blurred_docks.get(container);
        if (!info) return;

        this._log("unblurring dock");

        // disconnect all tracked signals
        if (info.signal_ids) {
            for (let [actor, id] of info.signal_ids) {
                try { actor.disconnect(id); } catch (e) { }
            }
        }

        // destroy the pipeline
        try {
            info.pipeline.destroy();
        } catch (e) {
            this._warn(`failed to destroy pipeline: ${e.message}`);
        }

        // remove and destroy the wrapper
        if (info.wrapper) {
            try {
                let parent = info.wrapper.get_parent();
                if (parent)
                    parent.remove_child(info.wrapper);
                info.wrapper.destroy_all_children();
                info.wrapper.destroy();
            } catch (e) {
                // wrapper already disposed by parent destruction
            }
        }

        this._blurred_docks.delete(container);
    }

    // ─── Context Menu Blur ──────────────────────────────────────────

    /// Inject blur behind a Dhruva context menu overlay
    _blur_context_menu(overlay) {
        if (this._blurred_menus.has(overlay)) return;

        this._log("blurring context menu");

        // find menuContainer → panel within the overlay
        // Dhruva structure: overlay → menuContainer (BinLayout) → [bgDrawingArea, panel]
        let menuContainer = null;
        let panel = null;
        let bgDrawingArea = null;

        let overlay_children = overlay.get_children();
        for (let child of overlay_children) {
            // menuContainer uses BinLayout and contains the panel
            let gc = child.get_children();
            if (gc && gc.length >= 2) {
                menuContainer = child;
                for (let sub of gc) {
                    if (sub instanceof St.DrawingArea)
                        bgDrawingArea = sub;
                    else if (sub instanceof St.BoxLayout)
                        panel = sub;
                }
                break;
            }
        }

        if (!menuContainer || !panel) {
            this._log("could not find menuContainer/panel in context menu overlay");
            return;
        }

        // wait for allocation to stabilize, then inject blur
        let alloc_handler_id = panel.connect('notify::allocation', () => {
            panel.disconnect(alloc_handler_id);
            this._inject_context_menu_blur(overlay, menuContainer, panel, bgDrawingArea);
        });

        // also try immediate if already allocated
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!this._blurred_menus.has(overlay) && panel.get_allocation_box()) {
                try { panel.disconnect(alloc_handler_id); } catch (e) { }
                this._inject_context_menu_blur(overlay, menuContainer, panel, bgDrawingArea);
            }
            return GLib.SOURCE_REMOVE;
        });

        // track destroy for cleanup
        let destroy_id = overlay.connect('destroy', () => {
            this._unblur_context_menu(overlay);
        });

        this._blurred_menus.set(overlay, {
            destroy_id,
            alloc_handler_id,
            menuContainer,
            panel,
            pipeline: null,
            blurWidget: null
        });
    }

    /// Actually create and insert the blur widget for a context menu
    _inject_context_menu_blur(overlay, menuContainer, panel, bgDrawingArea) {
        if (!overlay || !menuContainer) return;
        let info = this._blurred_menus.get(overlay);
        if (!info || info.blurWidget) return; // already injected

        const pipeline = new DummyPipeline(
            this.effects_manager,
            this.settings.dhruva
        );
        let [blurWidget, bgManager] = pipeline.create_background_with_effect(
            menuContainer, 'bms-dhruva-menu-blurred-widget'
        );

        // position blur to cover the panel area (not the arrow)
        let alloc = panel.get_allocation_box();
        blurWidget.set_position(alloc.get_x(), alloc.get_y());
        blurWidget.set_size(alloc.get_width(), alloc.get_height());

        // place behind bgDrawingArea if possible
        if (bgDrawingArea) {
            menuContainer.set_child_below_sibling(blurWidget, bgDrawingArea);
        }

        // match the show animation
        blurWidget.opacity = 0;
        blurWidget.set_scale(0.95, 0.95);
        blurWidget.set_pivot_point(
            menuContainer.pivot_point_x || 0.5,
            menuContainer.pivot_point_y || 0.5
        );
        blurWidget.ease({
            opacity: 255,
            scale_x: 1.0,
            scale_y: 1.0,
            duration: 180,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });

        info.pipeline = pipeline;
        info.blurWidget = blurWidget;
        info.bgManager = bgManager;
    }

    /// Remove blur from a context menu overlay
    _unblur_context_menu(overlay) {
        let info = this._blurred_menus.get(overlay);
        if (!info) return;

        this._log("unblurring context menu");

        try {
            if (info.destroy_id && overlay)
                overlay.disconnect(info.destroy_id);
        } catch (e) { }

        try {
            if (info.pipeline)
                info.pipeline.destroy();
        } catch (e) { }

        this._blurred_menus.delete(overlay);
    }

    // ─── Logging ────────────────────────────────────────────────────

    _log(str) {
        if (this.settings.DEBUG)
            console.log(`[Blur my Shell > dhruva]        ${str}`);
    }

    _warn(str) {
        console.warn(`[Blur my Shell > dhruva] ${str}`);
    }
};
