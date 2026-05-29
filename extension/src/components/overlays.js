import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { DisposableStore } from '../runtime/disposable_store.js';
import { actorSignature } from '../overlays/actor_utils.js';
import { OverlayHookManager } from '../overlays/overlay_hook_manager.js';
import { OverlaySurfaceRegistry } from '../overlays/overlay_surface_registry.js';

const WORKSPACE_SWITCH_SUSPEND_USEC = 350_000;
const OVERVIEW_SUSPEND_USEC = 450_000;

export const OverlaysBlur = class OverlaysBlur {
    constructor(connections, settings, effects_manager) {
        this.connections = connections;
        this.settings = settings;
        this.effects_manager = effects_manager;
        this.enabled = false;
        this._skip_log = new Set();
        this._registry = null;
        this._hooks = null;
        this._suspendedUntil = 0;
        this._suspensionSourceId = 0;
        this._suspensionDisposables = new DisposableStore();
        this._pendingOverlayRefresh = false;
        this._perfCounters = new Map();
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

        this.connections.connect(global.window_manager, 'switch-workspace',
            () => this._suspendOverlayWork(WORKSPACE_SWITCH_SUSPEND_USEC, 'workspace-switch'));
        this.connections.connect(Main.overview, 'showing',
            () => this._suspendOverlayWork(OVERVIEW_SUSPEND_USEC, 'overview-showing'));
        this.connections.connect(Main.overview, 'hiding',
            () => this._suspendOverlayWork(WORKSPACE_SWITCH_SUSPEND_USEC, 'overview-hiding'));
        this.connections.connect(Main.overview, 'hidden',
            () => this._resumeOverlayWork('overview-hidden'));
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
        this._clearSuspensionTimer();
        this._suspensionDisposables.dispose();
        this._suspensionDisposables = new DisposableStore();
        this._suspendedUntil = 0;
        this._pendingOverlayRefresh = false;
        this._perfLogCounters('disable-summary');
        this._perfCounters.clear();
        this.connections.disconnect_all();
        this.enabled = false;
    }

    syncTargets(rebuildAttached = false) {
        if (!this.enabled)
            return;

        if (this.isOverlayWorkSuspended())
            this._markPendingOverlayRefresh('sync-targets');

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

    isOverlayWorkSuspended() {
        return GLib.get_monotonic_time() < this._suspendedUntil;
    }

    _suspendOverlayWork(durationUsec, reason = '') {
        const now = GLib.get_monotonic_time();
        const nextSuspendUntil = now + durationUsec;
        if (nextSuspendUntil > this._suspendedUntil)
            this._suspendedUntil = nextSuspendUntil;
        this._registry?.hideAllSurfaces(reason || 'suspended');
        this._scheduleSuspensionRefresh();

        if (this.settings.DEBUG)
            this._log(`overlay discovery suspended for ${(durationUsec / 1000).toFixed(0)}ms (${reason})`);
    }

    _resumeOverlayWork(reason = '') {
        this._suspendedUntil = 0;
        this._clearSuspensionTimer();
        this._flushPendingOverlayRefresh(reason);

        if (this.settings.DEBUG)
            this._log(`overlay discovery resumed (${reason})`);
    }

    _scheduleSuspensionRefresh() {
        this._clearSuspensionTimer();
        const remainingUsec = Math.max(0, this._suspendedUntil - GLib.get_monotonic_time());
        const delayMs = Math.max(16, Math.ceil(remainingUsec / 1000) + 16);

        this._suspensionDisposables.dispose();
        this._suspensionDisposables = new DisposableStore();
        this._suspensionSourceId = this._suspensionDisposables.addSource(GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
            this._suspensionSourceId = 0;
            if (this.enabled && !this.isOverlayWorkSuspended())
                this._flushPendingOverlayRefresh('suspension-timeout');
            return GLib.SOURCE_REMOVE;
        }));
    }

    _clearSuspensionTimer() {
        if (!this._suspensionSourceId)
            return;

        try {
            GLib.source_remove(this._suspensionSourceId);
        } catch {
            // Source may already be removed.
        }
        this._suspensionSourceId = 0;
    }

    _markPendingOverlayRefresh(reason = '') {
        if (!this.enabled)
            return;

        this._pendingOverlayRefresh = true;
        if (this.settings.DEBUG)
            this._log(`overlay refresh deferred during suspension (${reason})`);
    }

    _flushPendingOverlayRefresh(reason = '') {
        if (!this._pendingOverlayRefresh)
            return;

        this._pendingOverlayRefresh = false;
        this._registry?.queueRefresh(`resume-${reason}`);
    }

    _perfStart() {
        if (!this.settings.DEBUG)
            return 0;
        return GLib.get_monotonic_time();
    }

    _perfEnd(label, start, extra = '') {
        if (!this.settings.DEBUG || !start)
            return;

        const ms = (GLib.get_monotonic_time() - start) / 1000;
        const suffix = extra ? ` ${extra}` : '';
        console.log(`[Blur my Shell > overlays perf] ${label}: ${ms.toFixed(2)}ms${suffix}`);
    }

    _perfCount(name, delta = 1) {
        if (!this.settings.DEBUG)
            return;

        const current = this._perfCounters.get(name) ?? 0;
        this._perfCounters.set(name, current + delta);
    }

    _perfSet(name, value) {
        if (!this.settings.DEBUG)
            return;
        this._perfCounters.set(name, value);
    }

    _perfLogCounters(prefix = 'counters') {
        if (!this.settings.DEBUG || this._perfCounters.size === 0)
            return;

        const counters = [...this._perfCounters.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(' ');
        console.log(`[Blur my Shell > overlays perf] ${prefix} ${counters}`);
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
