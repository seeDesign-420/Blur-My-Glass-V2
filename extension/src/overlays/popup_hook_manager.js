import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';

import {
    resolvePopupContentActor,
    getOpenStateActor,
    isDhruvaContextMenuOverlayActor,
} from './actor_utils.js';
import { PopupOverlayController } from './popup_overlay_controller.js';

export class PopupHookManager {
    constructor(runtime) {
        this.runtime = runtime;
        this._popupOpenOverride = null;
        this._popupCloseOverride = null;
        this._popupDestroyOverride = null;
        this._dynamicMenus = new Map();
        this._nextId = 1;
    }

    install() {
        if (this._popupOpenOverride)
            return;

        this._popupOpenOverride = PopupMenu.PopupMenu.prototype.open;
        this._popupCloseOverride = PopupMenu.PopupMenu.prototype.close;
        this._popupDestroyOverride = PopupMenu.PopupMenu.prototype.destroy;

        const manager = this;
        PopupMenu.PopupMenu.prototype.open = function (...args) {
            if (args.length === 0 || args[0] === undefined)
                args[0] = BoxPointer.PopupAnimation.FULL;
            const result = manager._popupOpenOverride.apply(this, args);
            manager._maybeTrackDynamicMenu(this);
            manager._dynamicMenus.get(this)?.sync();
            return result;
        };

        PopupMenu.PopupMenu.prototype.close = function (...args) {
            if (args.length === 0 || args[0] === undefined)
                args[0] = BoxPointer.PopupAnimation.FULL;
            return manager._popupCloseOverride.apply(this, args);
        };

        PopupMenu.PopupMenu.prototype.destroy = function (...args) {
            manager._untrackDynamicMenu(this);
            return manager._popupDestroyOverride.apply(this, args);
        };
    }

    uninstall() {
        if (!this._popupOpenOverride)
            return;

        PopupMenu.PopupMenu.prototype.open = this._popupOpenOverride;
        PopupMenu.PopupMenu.prototype.close = this._popupCloseOverride;
        PopupMenu.PopupMenu.prototype.destroy = this._popupDestroyOverride;

        this._popupOpenOverride = null;
        this._popupCloseOverride = null;
        this._popupDestroyOverride = null;

        for (const controller of this._dynamicMenus.values())
            controller.destroy();
        this._dynamicMenus.clear();
    }

    syncAll() {
        for (const [menu, controller] of this._dynamicMenus.entries()) {
            if (!this.runtime.isTargetEnabled(controller.target) && !menu?.isOpen) {
                this._untrackDynamicMenu(menu);
                continue;
            }
            controller.sync();
        }
    }

    _isTrackedMenu(menu) {
        if (this._dynamicMenus.has(menu))
            return true;

        return this.runtime._registry?.isTrackedMenu(menu) ?? false;
    }

    _isEligibleDynamicMenu(menu) {
        if (!menu?.actor || !menu?.box)
            return false;
        if (this.runtime.isOverlayWorkSuspended())
            return false;
        if (isDhruvaContextMenuOverlayActor(menu.actor))
            return false;

        if (this._isTrackedMenu(menu))
            return false;

        const parent = menu.actor.get_parent?.();
        if (!parent)
            return false;

        return parent === Main.layoutManager.uiGroup;
    }

    _resolveDynamicTarget(menu) {
        const styleClass = menu?.actor?.get_style_class_name?.() ?? '';
        if (styleClass.includes('background-menu'))
            return 'desktop-menus';
        if (styleClass.includes('window-menu') || styleClass.includes('app-menu'))
            return 'app-menus';
        return 'panel-menus';
    }

    _maybeTrackDynamicMenu(menu) {
        if (!this._isEligibleDynamicMenu(menu))
            return;

        const target = this._resolveDynamicTarget(menu);
        if (!this.runtime.isTargetEnabled(target))
            return;

        const content = resolvePopupContentActor(menu.actor);
        if (!content)
            return;

        const id = `dynamic-popup-${this._nextId++}`;
        const controller = new PopupOverlayController(this.runtime, {
            id,
            target,
            menu,
            getSurfaceActor: () => resolvePopupContentActor(menu.actor),
            getInsertActor: () => menu._boxPointer ?? menu.actor,
            getOpenStateActor: () => getOpenStateActor(menu, content),
        });

        this._dynamicMenus.set(menu, controller);
        this.runtime._perfCount('controllers.created');
        controller.enable();
    }

    _untrackDynamicMenu(menu) {
        const controller = this._dynamicMenus.get(menu);
        if (!controller)
            return;

        controller.destroy();
        this._dynamicMenus.delete(menu);
        this.runtime._perfCount('controllers.destroyed');
    }
}
