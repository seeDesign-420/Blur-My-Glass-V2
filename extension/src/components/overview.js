import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { WorkspaceAnimationController } from 'resource:///org/gnome/shell/ui/workspaceAnimation.js';
const wac_proto = WorkspaceAnimationController.prototype;

import { DynamicBlurPipeline } from '../blur/dynamic_blur_pipeline.js';

const OVERVIEW_COMPONENTS_STYLE = [
    "overview-components-light",
    "overview-components-dark",
    "overview-components-transparent"
];


export const OverviewBlur = class OverviewBlur {
    constructor(connections, settings, effects_manager) {
        this.connections = connections;
        this.settings = settings;
        this.effects_manager = effects_manager;
        this.overview_background_managers = [];
        this.overview_background_group = new Meta.BackgroundGroup(
            { name: 'bms-overview-backgroundgroup' }
        );
        this.animation_background_managers = [];
        this.animation_background_group = new Meta.BackgroundGroup(
            { name: 'bms-animation-backgroundgroup' }
        );
        this.enabled = false;
        this.proto_patched = false;
        this._workspaceVisibilityQueued = false;
        this._workspaceVisibilityLaterId = 0;
        this._workspaceSwitchTouchedWindows = new Set();
    }

    enable() {
        this._log("blurring overview");

        // add css class name for workspace-switch background
        Main.uiGroup.add_style_class_name("blurred-overview");

        // add css class name to make components semi-transparent if wanted
        this.update_components_classname();

        // update backgrounds when the component is enabled
        this.update_backgrounds();

        // connect to monitors change
        this.connections.connect(Main.layoutManager, 'monitors-changed',
            _ => this.update_backgrounds()
        );

        // part for the workspace animation switch

        // make sure not to do this part if the functions were patched prior, as
        // the functions would call themselves and cause infinite recursion
        if (!this.proto_patched) {
            // store original workspace switching methods for restoring them on
            // disable()
            this._original_PrepareSwitch = wac_proto._prepareWorkspaceSwitch;
            this._original_FinishSwitch = wac_proto._finishWorkspaceSwitch;

            const w_m = global.workspace_manager;
            const outer_this = this;

            // create a blurred background actor for each monitor during a
            // workspace switch
            wac_proto._prepareWorkspaceSwitch = function (...params) {
                outer_this._log("prepare workspace switch");
                outer_this._original_PrepareSwitch.apply(this, params);

                // this permits to show the blur behind windows that are on
                // workspaces on the left and right
                if (
                    outer_this.settings.applications.BLUR
                ) {
                    let ws_index = w_m.get_active_workspace_index();
                    [ws_index - 1, ws_index + 1].forEach(
                        i => w_m.get_workspace_by_index(i)?.list_windows().forEach(
                            window => {
                                const window_actor = window.get_compositor_private();
                                if (window_actor) {
                                    window_actor.show();
                                    outer_this._workspaceSwitchTouchedWindows.add(window);
                                }
                            }
                        )
                    );
                }

                Main.uiGroup.insert_child_above(
                    outer_this.animation_background_group,
                    global.window_group
                );

                outer_this.animation_background_managers.forEach(bg_manager => {
                    const visible = !(
                        Meta.prefs_get_workspaces_only_on_primary() &&
                        bg_manager._monitorIndex !== Main.layoutManager.primaryMonitor.index
                    );
                    bg_manager._bms_pipeline?.set_visible?.(visible);
                });
            };

            // remove the workspace-switch actors when the switch is done
            wac_proto._finishWorkspaceSwitch = function (...params) {
                outer_this._log("finish workspace switch");
                outer_this._original_FinishSwitch.apply(this, params);

                // this hides windows that are not on the current workspace
                if (
                    outer_this.settings.applications.BLUR
                ) {
                    // compile blacklist patterns once for this switch
                    const blacklist = outer_this.settings.applications.BLACKLIST || [];
                    const blacklist_regexes = blacklist.map(pattern => {
                        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
                        return new RegExp('^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
                    });

                    outer_this._workspaceSwitchTouchedWindows.forEach(window => {
                        if (!window)
                            return;
                        if (window.is_on_all_workspaces())
                            return;
                        if (window.get_window_type() === Meta.WindowType.DESKTOP)
                            return;
                        const wm_class = window.get_wm_class();
                        if (wm_class && blacklist_regexes.some(re => re.test(wm_class)))
                            return;

                        window.get_compositor_private()?.hide();
                    });
                    outer_this._workspaceSwitchTouchedWindows.clear();
                }

                Main.uiGroup.remove_child(outer_this.animation_background_group);
            };

            this.proto_patched = true;
        }

        this.enabled = true;
    }

    update_backgrounds() {
        // remove every old background
        this.remove_background_actors();
        // create new backgrounds for the overview and the animation
        for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
            const pipeline_overview = new DynamicBlurPipeline(
                this.effects_manager,
                this.settings.overview,
                null,
                { effect_type: 'native_static_gaussian_blur' }
            );
            const [overview_actor, overview_bg_manager] = pipeline_overview.create_wallpaper_background_with_effect(
                this.overview_background_group,
                i,
                'bms-overview-blurred-widget'
            );
            if (!overview_actor || !overview_bg_manager)
                continue;
            overview_bg_manager._monitorIndex = i;
            this.overview_background_managers.push(overview_bg_manager);

            const pipeline_animation = new DynamicBlurPipeline(
                this.effects_manager,
                this.settings.overview,
                null,
                { effect_type: 'native_static_gaussian_blur' }
            );
            const [animation_actor, animation_bg_manager] = pipeline_animation.create_wallpaper_background_with_effect(
                this.animation_background_group,
                i,
                'bms-animation-blurred-widget'
            );
            if (!animation_actor || !animation_bg_manager)
                continue;
            animation_bg_manager._monitorIndex = i;
            this.animation_background_managers.push(animation_bg_manager);
        }
        // add the container widget for the overview only to the overview group
        Main.layoutManager.overviewGroup.insert_child_at_index(this.overview_background_group, 0);
        // make sure it stays below
        this.connections.connect(Main.layoutManager.overviewGroup, "child-added", (_, child) => {
            if (child !== this.overview_background_group) {
                if (this.overview_background_group.get_parent())
                    Main.layoutManager.overviewGroup.remove_child(this.overview_background_group);
                Main.layoutManager.overviewGroup.insert_child_at_index(this.overview_background_group, 0);
            }
            this._queue_workspace_background_visibility_sync();
        });
        this.connections.connect(Main.layoutManager.overviewGroup, ['child-added', 'child-removed'],
            _ => this._queue_workspace_background_visibility_sync()
        );
        this._queue_workspace_background_visibility_sync();
        this.update_opacity();
    }

    update_effects() {
        [
            ...this.overview_background_managers,
            ...this.animation_background_managers,
        ].forEach(bg_manager => bg_manager._bms_pipeline?.reapply_settings?.());
    }

    update_opacity() {
        const value = Math.max(0, Math.min(1, this.settings.overview.OPACITY ?? 1));
        const opacity = Math.round(value * 255);
        [
            ...this.overview_background_managers,
            ...this.animation_background_managers,
        ].forEach(bg_manager => {
            bg_manager._bms_pipeline?.set_opacity?.(opacity);
        });
    }


    _queue_workspace_background_visibility_sync() {
        if (this._workspaceVisibilityQueued)
            return;

        this._workspaceVisibilityQueued = true;
        try {
            this._workspaceVisibilityLaterId = Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                this._workspaceVisibilityLaterId = 0;
                return this._run_workspace_background_visibility_sync();
            });
            return;
        } catch (e) {
            this._workspaceVisibilityQueued = false;
        }
    }

    _run_workspace_background_visibility_sync() {
        this._workspaceVisibilityQueued = false;
        this._sync_workspace_background_visibility();
        return false;
    }

    _clear_workspace_background_visibility_sync() {
        this._workspaceVisibilityQueued = false;
        if (this._workspaceVisibilityLaterId) {
            try {
                Meta.later_remove(this._workspaceVisibilityLaterId);
            } catch (e) {
            }
            this._workspaceVisibilityLaterId = 0;
        }

    }

    _sync_workspace_background_visibility() {
        this._set_workspace_background_visibility(false);
    }

    _set_workspace_background_visibility(visible) {
        const root = Main.layoutManager.overviewGroup;
        if (!root)
            return;

        const stack = [root];
        while (stack.length > 0) {
            const actor = stack.pop();
            const styleClass = actor?.get_style_class_name?.() ?? actor?.style_class ?? '';
            if (styleClass.split(/\s+/).includes('workspace-background'))
                actor.visible = visible;

            actor?.get_children?.().forEach(child => stack.push(child));
        }
    }

    /// Updates the classname to style overview components with semi-transparent
    /// backgrounds.
    update_components_classname() {
        OVERVIEW_COMPONENTS_STYLE.forEach(
            style => Main.uiGroup.remove_style_class_name(style)
        );

        if (this.settings.overview.STYLE_COMPONENTS > 0)
            Main.uiGroup.add_style_class_name(
                OVERVIEW_COMPONENTS_STYLE[this.settings.overview.STYLE_COMPONENTS - 1]
            );
    }

    remove_background_actors() {
        this.connections.disconnect_all_for(Main.layoutManager.overviewGroup);
        if (this.overview_background_group.get_parent())
            Main.layoutManager.overviewGroup.remove_child(this.overview_background_group);

        this.overview_background_managers.forEach(background_manager => {
            background_manager._bms_pipeline.destroy();
            background_manager.destroy();
        });
        this.animation_background_managers.forEach(background_manager => {
            background_manager._bms_pipeline.destroy();
            background_manager.destroy();
        });
        this.overview_background_managers = [];
        this.animation_background_managers = [];

        this.overview_background_group.destroy_all_children();
        this.animation_background_group.destroy_all_children();
    }

    disable() {
        this._clear_workspace_background_visibility_sync();
        this._log("removing blur from overview");

        this._set_workspace_background_visibility(true);
        this.remove_background_actors();
        Main.uiGroup.remove_style_class_name("blurred-overview");
        OVERVIEW_COMPONENTS_STYLE.forEach(
            style => Main.uiGroup.remove_style_class_name(style)
        );

        this.connections.disconnect_all();
        this.enabled = false;
    }

    restore_patched_proto() {
        if (this.proto_patched) {
            if (this._original_PrepareSwitch)
                wac_proto._prepareWorkspaceSwitch = this._original_PrepareSwitch;
            if (this._original_FinishSwitch)
                wac_proto._finishWorkspaceSwitch = this._original_FinishSwitch;

            this.proto_patched = false;
        }
    }

    _log(str) {
        if (this.settings.DEBUG)
            console.log(`[Blur my Shell > overview]     ${str}`);
    }

    _warn(str) {
        console.warn(`[Blur my Shell > overview]     ${str}`);
    }
};
