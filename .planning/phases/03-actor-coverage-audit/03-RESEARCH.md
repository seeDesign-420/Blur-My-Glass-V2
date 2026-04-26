# Phase 3: Actor Coverage Audit — Research

> Researched: 2026-04-26

## Question

Which Clutter actors in GNOME Shell are NOT currently wrapped with a blur/glass effect?

## Methodology

1. Mapped all major UI actor classes in `src/gnome-shell/js/ui/`
2. Identified upstream Shell.BlurEffect usage (only `unlockDialog.js`)
3. Cataloged blur-my-shell extension's component coverage (`components/*.js`)
4. Cross-referenced to find gaps

## Findings

### Upstream GNOME Shell — Native BlurEffect Usage

Only **1** place uses `Shell.BlurEffect` natively:

| Actor | File | Usage |
|-------|------|-------|
| Lock Screen | `unlockDialog.js:709` | `new Shell.BlurEffect({name: 'blur'})` — background blur behind login prompt |

### blur-my-shell Extension — Current Coverage

The extension (`blur-my-shell@aunetx`) has **9** component modules:

| Component | File | What It Blurs |
|-----------|------|---------------|
| Panel | `components/panel.js` | Top bar panel (`Main.panel`) |
| Overview | `components/overview.js` | Activities overview background |
| Dash to Dock | `components/dash_to_dock.js` | Dock/Dash background |
| Lock Screen | `components/lockscreen.js` | Lock screen background |
| App Folders | `components/appfolders.js` | App folder popup dialogs |
| Window List | `components/window_list.js` | Window list extension panel |
| Coverflow Alt-Tab | `components/coverflow_alt_tab.js` | Alt-Tab switcher overlay |
| Applications | `components/applications.js` | Individual application windows |
| Screenshot | `components/screenshot.js` | Screenshot selection overlay |

### GNOME Shell Actors NOT Currently Blurred

These are significant UI surfaces that could benefit from blur/glass effects:

| Actor | Class | File | Visual Surface |
|-------|-------|------|----------------|
| **Quick Settings Panel** | `QuickSettingsMenu` | `quickSettings.js` | Wi-Fi, Bluetooth, Night Light toggles dropdown |
| **Notification Center / Date Menu** | `DateMenuButton`, `CalendarMessageList` | `dateMenu.js`, `calendar.js` | Calendar dropdown + notification list |
| **Notification Banners** | `MessageTray`, `Notification` | `messageTray.js` | Pop-up notification toasts |
| **Modal Dialogs** | `ModalDialog` | `modalDialog.js` | System prompts, auth dialogs |
| **OSD Windows** | `OsdWindow` | `osdWindow.js` | Volume/brightness/capslock overlays |
| **Workspace Switcher Popup** | `WorkspaceSwitcherPopup` | `workspaceSwitcherPopup.js` | Ctrl+Alt+Arrow workspace indicator |
| **Workspace Thumbnails** | `ThumbnailsBox`, `WorkspaceThumbnail` | `workspaceThumbnail.js` | Minimap in overview sidebar |
| **Search Results** | `SearchResultsView` | `search.js` | Search results dropdown in overview |
| **Run Dialog** | Run command dialog | `runDialog.js` | Alt+F2 run dialog |
| **Close Dialog** | Window close confirmation | `closeDialog.js` | "Force Quit" dialog |
| **Welcome Dialog** | First-login welcome | `welcomeDialog.js` | Initial GNOME tour prompt |
| **End Session Dialog** | Log out/shutdown | `endSessionDialog.js` | Power off / Restart dialog |
| **Looking Glass** | Debug inspector | `lookingGlass.js` | Developer debug REPL |
| **Popup Menus** | `PopupMenu`, `PopupSubMenu` | `popupMenu.js` | Right-click context menus, app indicator menus |
| **Lightbox** | `Lightbox` | `lightbox.js` | Dimming overlay behind modal dialogs |

### Actor Hierarchy (Layout Manager)

```
global.stage
└── uiGroup (UiActor)
    ├── global.window_group
    │   └── _backgroundGroup (Meta.BackgroundGroup)
    ├── global.top_window_group
    ├── overviewGroup                    ← overview.js lives here
    ├── screenShieldGroup                ← lockscreen
    ├── panelBox                         ← panel.js
    ├── modalDialogGroup                 ← modal dialogs
    ├── screenTransition
    ├── dummyCursor
    └── feedbackGroup
```

### Priority Assessment

**High-value blur targets** (large visual surfaces, frequently visible):

1. **Quick Settings Panel** — Shown via click on panel indicators. Large dropdown area. **Most impactful** new blur target.
2. **Notification Center / Date Menu** — Calendar + message list. Large persistent surface.
3. **Notification Banners** — Small but very frequent. Would give macOS-style notification appearance.
4. **Modal Dialogs** — Auth prompts, system dialogs. Already have dim overlay — glass would replace dim.
5. **OSD Windows** — Volume/brightness indicators. Small but very frequent interaction.

**Medium-value targets** (visible but less frequent):

6. **Workspace Switcher Popup** — Brief display, but on every workspace switch
7. **Popup Menus** — Context menus, app indicator menus
8. **End Session / Close Dialog** — Power off, force quit prompts

**Low-value targets** (rare or developer-only):

9. **Run Dialog** — Alt+F2, rarely used
10. **Welcome Dialog** — One-time display
11. **Looking Glass** — Developer tool only
12. **Search Results** — Already in overview (may conflict with overview blur)

## RESEARCH COMPLETE
