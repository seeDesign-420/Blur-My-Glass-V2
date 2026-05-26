import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { DisposableStore } from '../runtime/disposable_store.js';
import {
    OPEN_ANIMATION_DURATION_MS,
    CLOSE_ANIMATION_DURATION_MS,
} from './constants.js';
import { getTransformSize, hasPositiveTransformedSize } from './geometry.js';
import { collectQuickSettingsControls } from './actor_utils.js';
import { QuickSettingsControlBlurSurface } from './quick_settings_control_surface.js';

const MAX_QUICK_SETTINGS_CONTROL_SURFACES = 12;
const MIN_QUICK_SETTINGS_CONTROL_AREA = 900;
const QUICK_SETTINGS_REFRESH_DEBOUNCE_MS = 48;

export class QuickSettingsControlBlurLayer {
    constructor(runtime, menu) {
        this.runtime = runtime;
        this.menu = menu;
        this._surfaces = new Map();
        this._disposables = new DisposableStore();
        this._gridDisposables = new DisposableStore();
        this._refresh_source_id = 0;
        this._open_source_id = 0;
        this._close_source_id = 0;
        this._nextSurfaceId = 1;
        this._overlayContainer = null;
        this._grid = null;
        this._shown = false;
        this._openSettled = false;
        this.destroyed = false;
    }

    enable() {
        if (this.destroyed || !this.menu)
            return;

        this._connect(this.menu, 'open-state-changed', (_menu, open) => {
            if (open) {
                this._cancelCloseHide();
                this._scheduleOpenRefresh();
            } else {
                this._openSettled = false;
                this._scheduleCloseHide();
            }
        });

        if (this.menu.actor)
            this._connect(this.menu.actor, 'destroy', () => this.destroy());

        if (this.isOpen()) {
            this._openSettled = true;
            this.sync();
        }
    }

    isOpen() {
        return Boolean(!this.destroyed && this.menu?.isOpen);
    }

    getOverlayParent() {
        return this._overlayContainer?.get_parent?.() ?? null;
    }

    _connect(obj, signal, callback) {
        try {
            this._disposables.addSignal(obj, signal, callback);
        } catch (e) {
            this.runtime._logSkipOnce('quick-settings', obj, `could not connect ${signal}: ${e}`);
        }
    }

    _connectGrid(grid, signal, callback) {
        try {
            this._gridDisposables.addSignal(grid, signal, callback);
        } catch (e) {
            this.runtime._logSkipOnce('quick-settings', grid, `could not connect ${signal}: ${e}`);
        }
    }

    _resolveGrid() {
        return this.menu?._grid ?? Main.panel?.statusArea?.quickSettings?._system?._grid ?? null;
    }

    _connectGridSignals(grid) {
        if (this._grid === grid)
            return;

        this._gridDisposables.dispose();
        this._gridDisposables = new DisposableStore();
        this._grid = grid;

        if (!grid)
            return;

        this._connectGrid(grid, 'child-added', () => this.queueRefresh());
        this._connectGrid(grid, 'child-removed', () => this.queueRefresh());
        this._connectGrid(grid, 'notify::allocation', () => this.queueRefresh());
        this._connectGrid(grid, 'destroy', () => {
            this._grid = null;
            this._gridDisposables.dispose();
            this._gridDisposables = new DisposableStore();
            this._destroySurfaces();
        });
    }

    _ensureOverlayContainer() {
        const parent = this._resolveOverlayParent();
        if (!parent)
            return false;

        if (!this._overlayContainer) {
            this._overlayContainer = new St.Widget({
                name: 'bms-overlay-quick-settings-layer',
                reactive: false,
                can_focus: false,
                track_hover: false,
                clip_to_allocation: false,
            });
        }

        if (this._overlayContainer.get_parent?.() !== parent) {
            try {
                this._overlayContainer.get_parent?.()?.remove_child(this._overlayContainer);
            } catch {
                // Ignore detach failures.
            }

            try {
                parent.insert_child_below(this._overlayContainer, this._insertActor);
            } catch (e) {
                this.runtime._warn(`failed to show quick-settings layer: ${e}`);
                return false;
            }
        }

        return true;
    }

    _resolveOverlayParent() {
        this._insertActor = this.menu?._boxPointer ?? this.menu?.actor ?? null;
        return this._insertActor?.get_parent?.() ?? null;
    }

    queueRefresh() {
        if (this._refresh_source_id || this.destroyed)
            return;
        if (!this.isOpen() || !this._openSettled)
            return;
        if (this.runtime.isOverlayWorkSuspended()) {
            this.runtime._perfCount('quick-settings.refresh_skipped_suspended');
            return;
        }

        this._refresh_source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, QUICK_SETTINGS_REFRESH_DEBOUNCE_MS, () => {
            this._refresh_source_id = 0;
            if (!this.destroyed && this.runtime.enabled)
                this.sync();
            return GLib.SOURCE_REMOVE;
        });
        this._disposables.addSource(this._refresh_source_id);
    }

    _scheduleOpenRefresh() {
        if (this._open_source_id)
            GLib.source_remove(this._open_source_id);

        this._openSettled = false;
        this._open_source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, OPEN_ANIMATION_DURATION_MS, () => {
            this._open_source_id = 0;
            this._openSettled = this.isOpen();
            if (!this.destroyed && this._openSettled)
                this.sync();
            return GLib.SOURCE_REMOVE;
        });
        this._disposables.addSource(this._open_source_id);
    }

    _scheduleCloseHide() {
        this._cancelOpenRefresh();
        if (this._close_source_id)
            return;

        this._close_source_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, CLOSE_ANIMATION_DURATION_MS, () => {
            this._close_source_id = 0;
            if (!this.destroyed && !this.isOpen())
                this._destroySurfaces();
            return GLib.SOURCE_REMOVE;
        });
        this._disposables.addSource(this._close_source_id);
    }

    _destroySurfaces() {
        this._shown = false;

        for (const surface of this._surfaces.values())
            surface.destroy();
        this._surfaces.clear();
        this.runtime._perfSet('quick-settings.surface-count', 0);

        if (this._overlayContainer?.get_parent?.()) {
            try {
                this._overlayContainer.get_parent().remove_child(this._overlayContainer);
            } catch {
                // Ignore detach failures.
            }
        }
    }

    _cancelOpenRefresh() {
        if (!this._open_source_id)
            return;

        GLib.source_remove(this._open_source_id);
        this._open_source_id = 0;
    }

    _cancelCloseHide() {
        if (!this._close_source_id)
            return;

        GLib.source_remove(this._close_source_id);
        this._close_source_id = 0;
    }

    _upsertSurface(actor, shape) {
        let surface = this._surfaces.get(actor);
        if (surface && surface.shape !== shape) {
            surface.destroy();
            this._surfaces.delete(actor);
            surface = null;
        }

        if (!surface) {
            const id = `quick-settings-control-${this._nextSurfaceId++}`;
            surface = new QuickSettingsControlBlurSurface(this.runtime, this, actor, shape, id);
            this._surfaces.set(actor, surface);
            surface.enable();
            this.runtime._perfCount('quick-settings.surfaces_created');
            return surface;
        }

        surface.shape = shape;
        surface.sync();
        return surface;
    }

    _isEligiblePerControlActor(actor) {
        if (!actor || !actor.visible || !actor.mapped)
            return false;

        const [width, height] = getTransformSize(actor);
        return (width * height) >= MIN_QUICK_SETTINGS_CONTROL_AREA;
    }

    _collectSurfaceCandidates(grid) {
        const controls = [];
        for (const { actor, shape } of collectQuickSettingsControls(grid)) {
            if (!this._isEligiblePerControlActor(actor))
                continue;

            controls.push({ actor, shape });
            if (controls.length >= MAX_QUICK_SETTINGS_CONTROL_SURFACES) {
                this.runtime._perfCount('quick-settings.surface_cap_hits');
                break;
            }
        }
        return controls;
    }

    sync() {
        if (this.destroyed)
            return;

        if (!this.runtime.isTargetEnabled('quick-settings')) {
            this._destroySurfaces();
            return;
        }

        if (!this.isOpen()) {
            this._scheduleCloseHide();
            return;
        }

        if (!this._openSettled)
            return;

        if (this.runtime.isOverlayWorkSuspended()) {
            this.runtime._perfCount('surfaces.create_blocked_suspended');
            return;
        }

        this._cancelCloseHide();

        const grid = this._resolveGrid();
        this._connectGridSignals(grid);

        if (!grid || !hasPositiveTransformedSize(grid) || !this._ensureOverlayContainer()) {
            this._destroySurfaces();
            return;
        }

        this._shown = true;

        const keepActors = new Set();
        for (const { actor, shape } of this._collectSurfaceCandidates(grid)) {
            keepActors.add(actor);
            this._upsertSurface(actor, shape);
        }

        for (const [actor, surface] of this._surfaces.entries()) {
            if (!keepActors.has(actor)) {
                surface.destroy();
                this._surfaces.delete(actor);
            }
        }

        for (const surface of this._surfaces.values())
            surface.sync();

        this.runtime._perfSet('quick-settings.surface-count', this._surfaces.size);
    }

    destroy() {
        if (this.destroyed)
            return;

        this.destroyed = true;
        this._refresh_source_id = 0;
        this._open_source_id = 0;
        this._close_source_id = 0;
        this._openSettled = false;
        this._disposables.dispose();
        this._gridDisposables.dispose();
        this._destroySurfaces();
    }
}
