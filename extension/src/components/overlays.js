import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { actorSignature } from '../overlays/actor_utils.js';
import { OverlayHookManager } from '../overlays/overlay_hook_manager.js';
import { OverlaySurfaceRegistry } from '../overlays/overlay_surface_registry.js';

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
