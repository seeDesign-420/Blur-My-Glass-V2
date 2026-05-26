import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import { update_from_old_settings } from './conveniences/settings_updater.js';
import { import_in_shell_only} from './conveniences/utils.js';
import { PipelinesManager } from './conveniences/pipelines_manager.js';
import { EffectsManager } from './conveniences/effects_manager.js';
import { Connections } from './conveniences/connections.js';
import { Settings } from './conveniences/settings.js';
import { KEYS } from './conveniences/keys.js';
import { ComponentRegistry } from './runtime/component_registry.js';
import { SessionModeController } from './runtime/session_mode_controller.js';
import { SettingsRouter } from './runtime/settings_router.js';
import { CapabilityService } from './runtime/capability_service.js';

import { PanelBlur } from './components/panel.js';
import { OverviewBlur } from './components/overview.js';
import { OverlaysBlur } from './components/overlays.js';
import { DhruvaBlur } from './components/dhruva.js';
import { LockscreenBlur } from './components/lockscreen.js';
import { AppFoldersBlur } from './components/appfolders.js';
import { WindowListBlur } from './components/window_list.js';
import { CoverflowAltTabBlur } from './components/coverflow_alt_tab.js';
import { ApplicationsBlur } from './components/applications.js';
import { ScreenshotBlur } from './components/screenshot.js';

const BlurModule = await import_in_shell_only('gi://Blur');


/// The main extension class, created when the GNOME Shell is loaded.
export default class BlurMyShell extends Extension {
    /// Enables the extension.
    enable() {
        // add the extension to global to make it accessible to other extensions
        // create it first as it is very useful when debugging crashes
        global.blur_my_shell = this;

        // update from old settings, very important for hacks level specifically
        update_from_old_settings(this.getSettings());

        // create a Settings instance, to manage extension's preferences
        // it needs to be loaded before logging, as it checks for DEBUG
        this._settings = new Settings(KEYS, this.getSettings());

        this._log("enabling extension...");

        // create main extension Connections instance
        this._connection = new Connections;

        // store it in a global array
        this._connections = [this._connection];

        // create a global effects manager (to prevent RAM bleeding)
        this._effects_manager = new EffectsManager(this._connection);

        // create a global pipelines manager, that helps talking with preferences
        this._pipelines_manager = new PipelinesManager(this._settings);
        this._settings_router = new SettingsRouter();
        this._capability_service = new CapabilityService(BlurModule);

        // create component instances and keep wiring metadata centralized.
        let init = () => {
            // create a Connections instance, to manage signals
            let connection = new Connections;

            // store it to keeps track of them globally
            this._connections.push(connection);

            return [connection, this._settings, this._effects_manager];
        };

        this._component_registry = new ComponentRegistry(this._settings);
        this._component_registry.register({
            key: 'panel',
            sessionScope: 'user',
            shouldEnable: settings => settings.panel.BLUR,
            factory: () => new PanelBlur(...init()),
        });
        this._component_registry.register({
            key: 'dhruva',
            sessionScope: 'user',
            shouldEnable: settings => settings.dhruva.BLUR,
            factory: () => new DhruvaBlur(...init()),
        });
        this._component_registry.register({
            key: 'overview',
            sessionScope: 'user',
            shouldEnable: settings => settings.overview.BLUR,
            factory: () => new OverviewBlur(...init()),
        });
        this._component_registry.register({
            key: 'overlays',
            sessionScope: 'user',
            shouldEnable: settings => settings.overlays.BLUR,
            factory: () => new OverlaysBlur(...init()),
        });
        this._component_registry.register({
            key: 'lockscreen',
            sessionScope: 'always',
            shouldEnable: settings => settings.lockscreen.BLUR,
            factory: () => new LockscreenBlur(...init()),
        });
        this._component_registry.register({
            key: 'appfolder',
            sessionScope: 'user',
            shouldEnable: settings => settings.appfolder.BLUR,
            factory: () => new AppFoldersBlur(...init()),
        });
        this._component_registry.register({
            key: 'window-list',
            sessionScope: 'user',
            shouldEnable: settings => settings.window_list.BLUR,
            factory: () => new WindowListBlur(...init()),
        });
        this._component_registry.register({
            key: 'coverflow-alt-tab',
            sessionScope: 'user',
            shouldEnable: settings => settings.coverflow_alt_tab.BLUR,
            factory: () => new CoverflowAltTabBlur(...init()),
        });
        this._component_registry.register({
            key: 'applications',
            sessionScope: 'user',
            shouldEnable: settings => settings.applications.BLUR,
            factory: () => new ApplicationsBlur(...init()),
        });
        this._component_registry.register({
            key: 'screenshot',
            sessionScope: 'user',
            shouldEnable: settings => settings.screenshot.BLUR,
            factory: () => new ScreenshotBlur(...init()),
        });
        this._component_registry.initAll(this);

        // Keep existing property names to avoid broad callback churn.
        this._panel_blur = this._component_registry.get('panel');
        this._dhruva_blur = this._component_registry.get('dhruva');
        this._overview_blur = this._component_registry.get('overview');
        this._overlays_blur = this._component_registry.get('overlays');
        this._lockscreen_blur = this._component_registry.get('lockscreen');
        this._appfolder_blur = this._component_registry.get('appfolder');
        this._window_list_blur = this._component_registry.get('window-list');
        this._coverflow_alt_tab_blur = this._component_registry.get('coverflow-alt-tab');
        this._applications_blur = this._component_registry.get('applications');
        this._screenshot_blur = this._component_registry.get('screenshot');

        // connect each component to preferences change
        this._connect_to_settings();

        // enable the lockscreen blur, only one important in both `user` session and `unlock-dialog`
        if (this._settings.lockscreen.BLUR && !this._lockscreen_blur.enabled)
            this._lockscreen_blur.enable();

        if (this._settings.dhruva.BLUR && !this._dhruva_blur.enabled)
            this._dhruva_blur.enable();

        if (this._settings.overlays.BLUR && !this._overlays_blur.enabled)
            this._overlays_blur.enable();

        // update whether or not the external rounded corners library was found
        this._update_rounded_blur_found();

        // ensure we take the correct action for the current session mode
        this._user_session_mode_enabled = false;
        this._session_mode_controller = new SessionModeController(
            () => this._enable_user_session(),
            () => this._disable_user_session()
        );
        this._on_session_mode_changed(Main.sessionMode);

        // watch for changes to the session mode
        this._connection.connect(Main.sessionMode, 'updated',
            () => this._on_session_mode_changed(Main.sessionMode)
        );
    }

    /// Enables the components related to the user session (everything except lockscreen blur).
    _enable_user_session() {
        this._log("changing mode to user session...");

        // maybe disable clipped redraw
        this._update_clipped_redraws();

        // enable every component
        // if the shell is still starting up, wait for it to be entirely loaded;
        // this should prevent bugs like #136 and #137
        if (Main.layoutManager._startingUp) {
            this._connection.connect(
                Main.layoutManager,
                'startup-complete',
                () => this._enable_components()
            );
        } else
            this._enable_components();

        // try to enable the components as soon as possible anyway, this way the
        // overview may load before the user sees it
        try {
            if (this._settings.overview.BLUR && !this._overview_blur.enabled)
                this._overview_blur.enable();
        } catch (e) {
            this._log("Could not enable overview blur directly");
            this._log(e);
        }
        try {
            if (this._settings.overlays.BLUR && !this._overlays_blur.enabled)
                this._overlays_blur.enable();
        } catch (e) {
            this._log("Could not enable overlays blur directly");
            this._log(e);
        }
        try {
            if (this._settings.panel.BLUR && !this._panel_blur.enabled)
                this._panel_blur.enable();
        } catch (e) {
            this._log("Could not enable panel blur directly");
            this._log(e);
        }

        // tells the extension we have enabled the user session components, so that we do not
        // disable them later if they were not even enabled to begin with
        this._user_session_mode_enabled = true;
    }

    /// Disables the extension.
    ///
    /// This extension needs to use the 'unlock-dialog' session mode in order to change the blur on
    /// the lockscreen. We have kind of two states of enablement for this extension:
    /// - the 'enabled' state, which means that we have created the necessary components (which only
    ///   are js objects) and enabled the lockscreen blur (which means swapping two functions from
    ///   the `UnlockDialog` constructor with our ones;
    /// - the 'user session enabled` mode, which means that we are in the 'enabled' mode AND we are
    ///   in the user mode, and so we enable all the other components that we created before.
    /// We switch from one state to the other thanks to `this._on_session_mode_changed`, and we
    /// track wether or not we are in the user mode with `this._user_session_mode_enabled` (because
    /// `this._on_session_mode_changed` might be called multiple times while in the user session
    /// mode, typically when going back from simple lockscreen and not sleep mode).
    disable() {
        this._log("disabling extension...");

        // disable every component from user session mode
        if (this._user_session_mode_enabled)
            this._disable_user_session();
        this._overview_blur.restore_patched_proto();

        // disable lockscreen blur too
        this._lockscreen_blur.disable();

        // untrack them
        this._panel_blur = null;
        this._dhruva_blur = null;
        this._overview_blur = null;
        this._overlays_blur = null;
        this._appfolder_blur = null;
        this._lockscreen_blur = null;
        this._window_list_blur = null;
        this._coverflow_alt_tab_blur = null;
        this._applications_blur = null;
        this._screenshot_blur = null;

        // make sure no settings change can re-enable them
        this._settings.disconnect_all_settings();

        // force disconnecting every signal, even if component crashed
        this._connections.forEach((connections) => {
            connections.disconnect_all();
        });
        this._connections = [];

        // remove the clipped redraws flag
        this._reenable_clipped_redraws();

        // remove the extension from GJS's global
        delete global.blur_my_shell;

        this._log("extension disabled.");

        this._settings = null;
        this._component_registry = null;
        this._session_mode_controller = null;
        this._settings_router = null;
        this._capability_service = null;
    }

    /// Disables the components related to the user session (everything except lockscreen blur).
    _disable_user_session() {
        this._log("disabling user session mode...");

        this._component_registry?.disableUserSessionComponents();

        // remove the clipped redraws flag
        this._reenable_clipped_redraws();

        // tells the extension we have disabled the user session components, so that we do not
        // disable them later again if they were already disabled
        this._user_session_mode_enabled = false;
    }

    /// Restarts the components related to the user session.
    _restart() {
        this._log("restarting...");

        this._disable_user_session();
        this._enable_user_session();

        this._log("restarted.");
    }

    /// Changes the extension to operate either on 'user' mode or 'unlock-dialog' mode, switching
    /// from one to the other means enabling/disabling every component except lockscreen blur.
    _on_session_mode_changed(session) {
        this._session_mode_controller.handleSessionModeChanged(
            session,
            this._user_session_mode_enabled
        );
    }

    /// Verify whether or not the gi://Blur library was found, in order to inform
    /// the preferences and instruct the user to install it to have native rounded
    /// corners in dynamic blur.
    _update_rounded_blur_found() {
        if (!this._capability_service.hasRoundedBlurSupport()) {
            this._settings.ROUNDED_BLUR_FOUND = false;
            this._log("using original implementation for the native blur effect")
        } else {
            this._settings.ROUNDED_BLUR_FOUND = true;
            this._log("using external library for the native blur effect")
        }
    }

    /// Add or remove the clutter debug flag to disable clipped redraws.
    /// This will entirely fix the blur effect, but should not be used except if
    /// the user really needs it, as clipped redraws are a huge performance
    /// boost for the compositor.
    _update_clipped_redraws() {
        if (this._settings.HACKS_LEVEL === 2)
            this._disable_clipped_redraws();
        else
            this._reenable_clipped_redraws();
    }

    /// Add the Clutter debug flag.
    _disable_clipped_redraws() {
        let gnome_shell_major_version = parseInt(Config.PACKAGE_VERSION.split('.')[0]);
        if (gnome_shell_major_version >= 48)
            Clutter.add_debug_flags(
                null, Clutter.DrawDebugFlag.DISABLE_CLIPPED_REDRAWS, null
            );
        else
            Meta.add_clutter_debug_flags(
                null, Clutter.DrawDebugFlag.DISABLE_CLIPPED_REDRAWS, null
            );
    }

    /// Remove the Clutter debug flag.
    _reenable_clipped_redraws() {
        let gnome_shell_major_version = parseInt(Config.PACKAGE_VERSION.split('.')[0]);
        if (gnome_shell_major_version >= 48)
            Clutter.remove_debug_flags(
                null, Clutter.DrawDebugFlag.DISABLE_CLIPPED_REDRAWS, null
            );
        else
            Meta.remove_clutter_debug_flags(
                null, Clutter.DrawDebugFlag.DISABLE_CLIPPED_REDRAWS, null
            );
    }

    /// Enables every component from the user session needed, should be called when the shell is
    /// entirely loaded as the `enable` methods interact with it.
    _enable_components() {
        this._component_registry?.enableUserSessionComponents();

        this._log("all components enabled.");
    }

    /// Updates needed things in each component when a preference changed
    _connect_to_settings() {
        this._settings_router.connect(this);
    }

    _log(str) {
        if (this._settings.DEBUG)
            console.log(`[Blur my Shell > extension]    ${str}`);
    }
}
