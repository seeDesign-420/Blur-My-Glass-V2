# Phase 3: Actor Coverage Audit — Research

> Researched: 2026-04-26

## Question

Which Clutter actors in GNOME Shell are NOT currently wrapped with a blur/glass effect?

## Methodology

1. Mapped all major UI actor classes in `src/gnome-shell/js/ui/`
2. Identified upstream `Shell.BlurEffect` usage (only `unlockDialog.js`)
3. Cataloged blur-my-shell extension's 9 component modules
4. Read blur-my-shell `components/panel.js` to understand the injection pattern
5. Analyzed each unblurred actor's class hierarchy, style-class, and parent chain

---

## Part 1: Current Blur Coverage

### Upstream GNOME Shell — Native BlurEffect Usage

Only **1** place uses `Shell.BlurEffect` natively:

| Actor | File | Line | Usage |
|-------|------|------|-------|
| Lock Screen | `unlockDialog.js` | 709 | `new Shell.BlurEffect({name: 'blur'})` — background blur behind login prompt |

### blur-my-shell Extension — 9 Component Modules

| Component | File | Target Actor | Access Path |
|-----------|------|-------------|-------------|
| Panel | `components/panel.js` | Top bar | `Main.panel` / `Main.layoutManager.panelBox` |
| Overview | `components/overview.js` | Activities overview background | `Main.overview._overview` |
| Dash to Dock | `components/dash_to_dock.js` | Dock/Dash background | Third-party extension actor |
| Lock Screen | `components/lockscreen.js` | Lock screen background | `Main.screenShield` |
| App Folders | `components/appfolders.js` | App folder popup dialogs | `AppDisplay.FolderIcon` prototype |
| Window List | `components/window_list.js` | Window list extension panel | Third-party extension actor |
| Coverflow Alt-Tab | `components/coverflow_alt_tab.js` | Alt-Tab switcher overlay | Third-party extension actor |
| Applications | `components/applications.js` | Individual application windows | Per-window via `MetaWindowActor` |
| Screenshot | `components/screenshot.js` | Screenshot selection overlay | `Main.screenshotUI` |

### blur-my-shell Injection Pattern

```
1. Create Meta.BackgroundGroup (captures background behind target)
2. Create Pipeline → wraps Shell.BlurEffect with configurable params
3. Insert BackgroundGroup at index 0 of target's parent container
4. Override target actor's background CSS to transparent
5. Connect lifecycle signals (show/hide/destroy/repaint)
```

---

## Part 2: Complete Unblurred Actor Inventory

### HIGH PRIORITY — Large Visual Surfaces, Frequently Visible

#### 1. Quick Settings Panel
| Property | Value |
|----------|-------|
| **Class** | `QuickSettingsMenu` (extends `PopupMenu.PopupMenu`) |
| **Actor** | `BoxPointer` → `St.Widget` with `bin` child |
| **File** | `quickSettings.js` |
| **Access Path** | `Main.panel.statusArea.quickSettings.menu` |
| **Container** | `this._boxPointer` (`BoxPointer` → `St.Widget`) |
| **Style Classes** | `quick-settings`, individual toggles use `quick-toggle button` |
| **Background** | Solid background via CSS `background-color` on BoxPointer `_border` |
| **Lifecycle** | Created once at shell startup. Toggled open/close via `PopupAnimation`. |
| **Approach** | **JS extension** — Insert `Meta.BackgroundGroup` behind `_boxPointer.bin`. Override CSS background to transparent. |
| **Complexity** | Medium — BoxPointer draws its own border/arrow via `St.DrawingArea._drawBorder()`, need to handle arrow separately |
| **Conflicts** | `_dimEffect` already added to `_boxPointer` at line 747 — may interact |

#### 2. Notification Center / Date Menu
| Property | Value |
|----------|-------|
| **Class** | `DateMenuButton` (extends `PanelMenu.Button`) |
| **Actor** | `BoxPointer` containing calendar + message list |
| **File** | `dateMenu.js` |
| **Access Path** | `Main.panel.statusArea.dateMenu.menu` |
| **Container** | `this._boxPointer.bin` → `St.BoxLayout` with calendar, events, messages |
| **Style Classes** | `datemenu-today-button`, `events-button`, `calendar` |
| **Background** | Solid CSS background on BoxPointer |
| **Lifecycle** | Created once. Toggled open/close. |
| **Approach** | **JS extension** — Same BoxPointer pattern as Quick Settings |
| **Complexity** | Medium — Same BoxPointer approach. Larger content area. |
| **Conflicts** | None known |

#### 3. Notification Banners (Toasts)
| Property | Value |
|----------|-------|
| **Class** | `MessageTray` (extends `St.Widget`) |
| **Actor** | `_bannerBin` (`St.Widget`) containing notification `Banner` actors |
| **File** | `messageTray.js` |
| **Access Path** | `Main.messageTray._bannerBin` |
| **Container** | `_bannerBin` uses `Clutter.BinLayout`, child is the current `Banner` |
| **Style Classes** | `notification-banner` (on individual banners) |
| **Background** | Solid background on banner via CSS |
| **Lifecycle** | **Dynamic** — banners are created/destroyed per notification. `_bannerBin` is persistent but children rotate. |
| **Approach** | **JS extension** — Attach blur to `_bannerBin` (persistent), not individual banners |
| **Complexity** | High — Must handle rapid creation/destruction. Banner size changes per notification. Need `allocation-changed` signals. |
| **Conflicts** | None — no existing effects on `_bannerBin` |

#### 4. Modal Dialogs
| Property | Value |
|----------|-------|
| **Class** | `ModalDialog` (extends `St.Widget`) |
| **Actor** | Self (`this`) added to `Main.layoutManager.modalDialogGroup` |
| **File** | `modalDialog.js` |
| **Access Path** | `Main.layoutManager.modalDialogGroup` children |
| **Container** | `backgroundStack` (`St.Widget`), `_backgroundBin` (`St.Bin`) |
| **Style Classes** | Varies by dialog type (see subclasses) |
| **Background** | Uses `Lightbox` for dimming overlay. Dialog content in `_backgroundBin`. |
| **Lifecycle** | **Dynamic** — dialogs created on demand, destroyed after use |
| **Approach** | **JS extension** — Replace `Lightbox` dim with blur on `_backgroundBin`, or add blur behind `backgroundStack` |
| **Complexity** | Medium — Must intercept dialog creation. `Lightbox` already provides a similar "behind" effect (dim). |
| **Conflicts** | `Lightbox` uses `RadialShaderEffect` — might need to be disabled or composited with blur |
| **Subclasses** | `EndSessionDialog`, `RunDialog`, `WelcomeDialog`, `AccessDialog`, `ShellMountOperation` all extend `ModalDialog` |

#### 5. OSD Windows
| Property | Value |
|----------|-------|
| **Class** | `OsdWindow` (extends `Clutter.Actor`) |
| **Actor** | Self, with `_hbox` (`St.BoxLayout`, style-class `osd-window`) |
| **File** | `osdWindow.js` |
| **Access Path** | `Main.osdWindowManager._osdWindows[monitorIndex]` |
| **Container** | `this._hbox` containing icon, label, level bar |
| **Style Classes** | `osd-window`, `level` (BarLevel) |
| **Background** | Solid CSS background on `_hbox` |
| **Lifecycle** | Created once per monitor at shell startup. Shown/hidden with animation. |
| **Approach** | **JS extension** — Insert `Meta.BackgroundGroup` behind `_hbox` in OsdWindow actor |
| **Complexity** | Low — Simple actor, fixed lifecycle, `add_child(Main.uiGroup)` |
| **Conflicts** | None — `Clutter.OffscreenRedirect.ALWAYS` is NOT set on OsdWindow |

---

### MEDIUM PRIORITY — Visible but Less Frequent

#### 6. Workspace Switcher Popup
| Property | Value |
|----------|-------|
| **Class** | `WorkspaceSwitcherPopup` (extends `Clutter.Actor`) |
| **File** | `workspaceSwitcherPopup.js` |
| **Access Path** | Created ad-hoc, added to `Main.uiGroup` |
| **Container** | `_list` (`St.BoxLayout`, style-class `workspace-switcher`) |
| **Background** | CSS background on `_list` |
| **Lifecycle** | Created on workspace switch, destroyed after timeout |
| **Approach** | **JS extension** |
| **Complexity** | Medium — `offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS` is set, which may interact with BlurEffect FBO chain |

#### 7. Popup Menus (Context Menus, App Indicator Menus)
| Property | Value |
|----------|-------|
| **Class** | `PopupMenu` (extends `PopupMenuBase`) |
| **File** | `popupMenu.js` |
| **Access Path** | `menu._boxPointer` on any `PanelMenu.Button` instance |
| **Container** | `BoxPointer` → `bin` → `box` (St.BoxLayout) |
| **Background** | CSS background on BoxPointer `_border` (`St.DrawingArea`) |
| **Lifecycle** | Persistent objects, toggled open/close |
| **Approach** | **JS extension** — Same BoxPointer pattern as Quick Settings/Date Menu |
| **Complexity** | Medium — Generic, applies to ALL popup menus. One implementation covers Quick Settings, Date Menu, and all right-click menus. |
| **Key Insight** | **BoxPointer blur is the highest-leverage single implementation** — it would blur Quick Settings, Date Menu, and all popup menus simultaneously. |

#### 8. End Session Dialog (Power Off / Restart)
| Property | Value |
|----------|-------|
| **Class** | `EndSessionDialog` (extends `ModalDialog`) |
| **File** | `endSessionDialog.js` |
| **Access Path** | Via ModalDialog mechanism |
| **Approach** | **Free** — covered by ModalDialog blur implementation (item 4) |
| **Complexity** | None — inherits from ModalDialog |

#### 9. Close Dialog (Force Quit Window)
| Property | Value |
|----------|-------|
| **Class** | `CloseDialog` (extends `GObject.Object`, creates `Dialog.Dialog`) |
| **File** | `closeDialog.js` |
| **Access Path** | Created per-window, attached to `Meta.Window` |
| **Container** | `Dialog.Dialog` is `St.Widget` attached to window's `MetaSurfaceActor` |
| **Approach** | **JS extension** — but different from ModalDialog (uses `Dialog.Dialog`, not `ModalDialog`) |
| **Complexity** | Medium — separate class hierarchy from ModalDialog |

---

### LOW PRIORITY — Rare or Developer-Only

#### 10. Run Dialog (Alt+F2)
| Property | Value |
|----------|-------|
| **Class** | `RunDialog` (extends `ModalDialog`) |
| **Approach** | **Free** — covered by ModalDialog blur (item 4) |

#### 11. Welcome Dialog (First Login)
| Property | Value |
|----------|-------|
| **Class** | `WelcomeDialog` (extends `ModalDialog`) |
| **Approach** | **Free** — covered by ModalDialog blur (item 4) |

#### 12. Access Dialog (Permission Prompts)
| Property | Value |
|----------|-------|
| **Class** | Extends `ModalDialog` |
| **Approach** | **Free** — covered by ModalDialog blur (item 4) |

#### 13. Looking Glass (Developer REPL)
| Property | Value |
|----------|-------|
| **Class** | Custom `St.Widget` with `_borderPaintTarget` |
| **File** | `lookingGlass.js` |
| **Approach** | **JS extension** — but low value, developer-only tool |
| **Complexity** | High — complex multi-pane actor |

#### 14. Search Results (Overview)
| Property | Value |
|----------|-------|
| **Class** | `SearchResultsView` (extends `St.BoxLayout`) |
| **File** | `search.js` |
| **Approach** | May conflict with existing overview blur |
| **Complexity** | Medium — lives inside overview, which already has blur |

---

## Part 3: Feasibility Summary

### All Targets Are JS Extension-Feasible

**No new C patches are required.** Every unblurred actor is either:
- An `St.Widget` subclass that supports `add_effect()`
- A `Clutter.Actor` subclass that supports `add_effect()`
- Uses `BoxPointer` (which is an `St.Widget`)

The existing `Shell.BlurEffect` (patched or unpatched) already supports `BACKGROUND` mode, which captures the texture behind the actor — exactly what's needed.

### Highest-Leverage Implementation: BoxPointer Blur

**Key insight:** Quick Settings, Date Menu, and ALL popup menus share the same `BoxPointer` actor class. A single `BoxPointer` blur implementation would cover:
- Quick Settings panel (high priority)
- Date Menu / Notification Center (high priority)
- All right-click context menus (medium priority)
- App indicator menus (medium priority)
- PopupSubMenus (medium priority)

This is the **single biggest bang-for-effort** feature: one implementation, 5+ blur targets.

### Implementation Priority (Effort vs. Impact)

| Rank | Target | Approach | Effort | Impact | Targets Covered |
|------|--------|----------|--------|--------|----------------|
| 1 | **BoxPointer** | JS blur on `BoxPointer.bin` | Medium | **Very High** | Quick Settings, Date Menu, all popup menus |
| 2 | **OSD Windows** | JS blur on `OsdWindow._hbox` | Low | Medium | Volume, brightness, caps lock overlays |
| 3 | **Modal Dialogs** | JS blur replacing Lightbox | Medium | High | End session, run dialog, welcome, auth prompts |
| 4 | **Notification Banners** | JS blur on `_bannerBin` | High | Medium | All notification toasts |
| 5 | **Workspace Switcher** | JS blur on `_list` | Low | Low | Workspace switch indicator |

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| BoxPointer `_drawBorder()` repaints may conflict with BlurEffect | Medium | Test with `_border` visibility toggled off; use CSS border-radius instead |
| `Clutter.OffscreenRedirect.ALWAYS` on WorkspaceSwitcherPopup | Low | May need to remove flag or test FBO stacking |
| Lightbox `RadialShaderEffect` conflict with BlurEffect on ModalDialog | Medium | May need to replace Lightbox entirely, not layer effects |
| Notification banner rapid lifecycle | Medium | Attach to persistent `_bannerBin`, not transient banner children |
| `Shell.BlurMode.BACKGROUND` may not work for all Z-order positions | Low | Test each actor's position in uiGroup hierarchy |

## RESEARCH COMPLETE
