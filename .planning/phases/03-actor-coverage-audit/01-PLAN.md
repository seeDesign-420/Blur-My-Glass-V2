---
phase: 3
name: Actor Coverage Audit
wave: 1
depends_on: []
files_modified:
  - .planning/phases/03-actor-coverage-audit/03-RESEARCH.md
  - .planning/phases/03-actor-coverage-audit/03-PLAN.md
autonomous: true
---

# Plan 01 — GNOME Shell Actor Coverage Audit

## Objective

Document which GNOME Shell Clutter actors are currently wrapped with blur/glass effects (by upstream or blur-my-shell) and which are not. Produce a priority-ranked feasibility matrix for extending blur coverage.

## must_haves

- [ ] Complete actor inventory with blur status (covered / not covered)
- [ ] Feasibility assessment: JS extension-only vs. C patch required
- [ ] Priority ranking by visual impact and frequency of display

## Tasks

<task id="01">
<title>Audit: Current blur coverage matrix</title>
<read_first>
- src/gnome-shell/js/ui/unlockDialog.js
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/extension.js
- /home/thomas/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/components/
</read_first>
<action>
Cross-reference GNOME Shell's native `Shell.BlurEffect` usage (only `unlockDialog.js`) with blur-my-shell's 9 component modules to produce a complete coverage matrix showing:

**Currently blurred (by blur-my-shell):**
- Panel (`Main.panel`)
- Overview background
- Dash to Dock
- Lock Screen
- App Folders
- Window List
- Coverflow Alt-Tab
- Application Windows
- Screenshot overlay

**Currently blurred (upstream):**
- Lock Screen (`unlockDialog.js:709`)

**NOT blurred — high priority:**
1. Quick Settings Panel (`quickSettings.js`) — large dropdown
2. Notification Center / Date Menu (`dateMenu.js`, `calendar.js`) — calendar + messages
3. Notification Banners (`messageTray.js`) — pop-up toasts
4. Modal Dialogs (`modalDialog.js`) — auth prompts, system dialogs
5. OSD Windows (`osdWindow.js`) — volume/brightness overlays

**NOT blurred — medium priority:**
6. Workspace Switcher Popup (`workspaceSwitcherPopup.js`)
7. Popup Menus (`popupMenu.js`) — context menus
8. End Session / Close Dialogs (`endSessionDialog.js`, `closeDialog.js`)

**NOT blurred — low priority:**
9. Run Dialog, Welcome Dialog, Looking Glass, Search Results

For each unblurred actor, document:
- Actor class name and parent hierarchy
- Whether it's an St.Widget or Clutter.Actor subclass
- Whether `add_effect()` can be called from JS (extension-level) or requires C patch
- Whether the actor has a solid background that would need to be made transparent first
</action>
<acceptance_criteria>
- Research document contains complete coverage matrix with all 15+ unblurred actors listed
- Each actor has class name, source file, and visual surface description
- Priority ranking (high/medium/low) assigned to each actor
- Feasibility column states "JS extension" or "C patch required" for each
</acceptance_criteria>
</task>

<task id="02">
<title>Feasibility: JS extension vs. C patch for each target</title>
<read_first>
- src/gnome-shell/js/ui/quickSettings.js
- src/gnome-shell/js/ui/messageTray.js
- src/gnome-shell/js/ui/modalDialog.js
- src/gnome-shell/js/ui/dateMenu.js
- src/gnome-shell/js/ui/osdWindow.js
- src/gnome-shell/js/ui/layout.js
- .planning/codebase/ARCHITECTURE.md
</read_first>
<action>
For each high-priority unblurred actor, determine the implementation approach:

**JS Extension Approach (preferred — no C patch needed):**
1. Get reference to actor via `Main.*` or class monkey-patching
2. Call `actor.add_effect(new Shell.BlurEffect({mode: Shell.BlurMode.BACKGROUND, ...}))`
3. Set `corner-radius` and optionally `refraction-strength` properties
4. Track lifecycle: connect to actor show/hide, add effect on map, remove on destroy

**Requirements for JS-only approach to work:**
- Actor must be accessible from `Main.*` or discoverable at runtime
- Actor background must be transparent (or made transparent via style override)
- BlurEffect must support `BACKGROUND` mode for behind-actor blur

**When C patch is needed:**
- Actor uses internal rendering that bypasses ClutterEffect
- Custom FBO chain modifications needed
- Performance requires texture sharing not available from JS

**Specific analysis per high-priority target:**

| Target | Approach | Notes |
|--------|----------|-------|
| Quick Settings | JS extension | Access via `Main.panel.statusArea.quickSettings._menu`. Background is St.BoxLayout with `style-class`. Make background transparent + add BlurEffect. |
| Date Menu / Notifications | JS extension | Access via `Main.panel.statusArea.dateMenu.menu._boxPointer._bin`. Similar to Quick Settings. |
| Notification Banners | JS extension | Access via `Main.messageTray._bannerBin`. Tricky lifecycle — banners are created/destroyed frequently. |
| Modal Dialogs | JS extension | Access via `Main.layoutManager.modalDialogGroup` children. Need to intercept dialog creation. |
| OSD Windows | JS extension | Access via `Main.osdWindowManager._osdWindows[]`. Simple — OSD is a Clutter.Actor with fixed lifecycle. |
</action>
<acceptance_criteria>
- Feasibility table has approach column ("JS extension" / "C patch") for all high-priority targets
- Each JS extension approach lists the specific Main.* access path
- Each entry notes potential lifecycle complications (creation, destruction, show/hide)
- At least one target is identified as needing C patch work (or explicitly stated all are JS-doable)
</acceptance_criteria>
</task>

## Verification

- [ ] Research document exists at `03-RESEARCH.md` with complete findings
- [ ] All 15+ unblurred actors documented with class, file, priority
- [ ] Feasibility assessment covers all high-priority targets
- [ ] Plan is actionable for future implementation phases
