export class SettingsRouter {
    connect(host) {
        const s = host._settings;

        s.HACKS_LEVEL_changed(() => host._restart());

        s.overview.BLUR_changed(() => {
            if (s.overview.BLUR) host._overview_blur.enable();
            else host._overview_blur.disable();
        });
        s.overview.STYLE_COMPONENTS_changed(() => {
            if (s.overview.BLUR) host._overview_blur.update_components_classname();
        });

        s.overlays.BLUR_changed(() => {
            if (s.overlays.BLUR) host._overlays_blur.enable();
            else host._overlays_blur.disable();
        });
        s.overlays.DATE_MENU_changed(() => {
            if (s.overlays.BLUR) host._overlays_blur.syncTargets();
        });
        s.overlays.QUICK_SETTINGS_changed(() => {
            if (s.overlays.BLUR) host._overlays_blur.syncTargets();
        });
        s.overlays.NOTIFICATIONS_changed(() => {
            if (s.overlays.BLUR) host._overlays_blur.syncTargets();
        });
        s.overlays.OSD_changed(() => {
            if (s.overlays.BLUR) host._overlays_blur.syncTargets();
        });
        s.overlays.DESKTOP_MENUS_changed(() => {
            if (s.overlays.BLUR) host._overlays_blur.syncTargets();
        });
        s.overlays.APP_MENUS_changed(() => {
            if (s.overlays.BLUR) host._overlays_blur.syncTargets();
        });

        s.appfolder.BLUR_changed(() => {
            if (s.appfolder.BLUR) host._appfolder_blur.enable();
            else host._appfolder_blur.disable();
        });
        s.appfolder.SIGMA_changed(() => {
            if (s.appfolder.BLUR) host._appfolder_blur.set_sigma(s.appfolder.SIGMA);
        });
        s.appfolder.BRIGHTNESS_changed(() => {
            if (s.appfolder.BLUR) host._appfolder_blur.set_brightness(s.appfolder.BRIGHTNESS);
        });
        s.appfolder.VIBRANCY_changed(() => {
            if (s.appfolder.BLUR) host._appfolder_blur.set_vibrancy(s.appfolder.VIBRANCY);
        });
        s.appfolder.STYLE_DIALOGS_changed(() => {
            if (s.appfolder.BLUR) host._appfolder_blur.blur_appfolders();
        });

        s.panel.BLUR_changed(() => {
            if (s.panel.BLUR) host._panel_blur.enable();
            else host._panel_blur.disable();
        });
        s.dhruva.BLUR_changed(() => {
            if (s.dhruva.BLUR) host._dhruva_blur.enable();
            else host._dhruva_blur.disable();
        });
        s.panel.UNBLUR_IN_OVERVIEW_changed(() => host._panel_blur.connect_to_windows_and_overview());
        s.panel.FORCE_LIGHT_TEXT_changed(() => {
            if (s.panel.BLUR) host._panel_blur.update_light_text_classname();
        });
        s.panel.OVERRIDE_BACKGROUND_changed(() => {
            if (s.panel.BLUR) host._panel_blur.connect_to_windows_and_overview();
        });
        s.panel.STYLE_PANEL_changed(() => {
            if (s.panel.BLUR) host._panel_blur.connect_to_windows_and_overview();
        });
        s.panel.OVERRIDE_BACKGROUND_DYNAMICALLY_changed(() => {
            if (s.panel.BLUR) host._panel_blur.connect_to_windows_and_overview();
        });

        s.applications.BLUR_changed(() => {
            if (s.applications.BLUR) host._applications_blur.enable();
            else host._applications_blur.disable();
        });
        s.applications.CORNER_WHEN_MAXIMIZED_changed(() => {
            if (s.applications.BLUR) host._applications_blur.update_all_corner_radii();
        });
        s.applications.OPACITY_changed(() => {
            if (s.applications.BLUR) host._applications_blur.set_opacity(s.applications.OPACITY);
        });
        s.applications.DYNAMIC_OPACITY_changed(() => {
            if (s.applications.BLUR) host._applications_blur.init_dynamic_opacity();
        });
        s.applications.BLUR_ON_OVERVIEW_changed(() => {
            if (s.applications.BLUR) host._applications_blur.connect_to_overview();
        });
        s.applications.ENABLE_ALL_changed(() => {
            if (s.applications.BLUR) host._applications_blur.update_all_windows();
        });
        s.applications.WHITELIST_changed(() => {
            if (s.applications.BLUR && !s.applications.ENABLE_ALL)
                host._applications_blur.update_all_windows();
        });
        s.applications.BLACKLIST_changed(() => {
            if (s.applications.BLUR && s.applications.ENABLE_ALL)
                host._applications_blur.update_all_windows();
        });

        s.lockscreen.BLUR_changed(() => {
            if (s.lockscreen.BLUR) host._lockscreen_blur.enable();
            else host._lockscreen_blur.disable();
        });

        s.hidetopbar.COMPATIBILITY_changed(() => {
            host._panel_blur.connect_to_windows_and_overview();
        });
        s.dash_to_panel.BLUR_ORIGINAL_PANEL_changed(() => {
            if (s.panel.BLUR) host._panel_blur.reset();
        });
    }
}
