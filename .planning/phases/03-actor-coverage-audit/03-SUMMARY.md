# Phase 3 Summary: Actor Coverage Audit

> Completed: 2026-04-26

## What Was Done

Performed a comprehensive audit of all GNOME Shell Clutter actors to determine which are currently wrapped with blur/glass effects and which are not. Produced a priority-ranked feasibility matrix for extending blur coverage.

## Key Findings

### Current State
- **Upstream GNOME Shell:** Uses `Shell.BlurEffect` in exactly **1** place (lock screen)
- **blur-my-shell extension:** Covers **9** components (panel, overview, dash, lockscreen, app folders, window list, coverflow alt-tab, applications, screenshot)
- **Unblurred actors identified:** **14** significant UI surfaces

### Highest-Leverage Discovery: BoxPointer Blur

The single most impactful implementation is blurring `BoxPointer` — it would cover:
- Quick Settings panel
- Date Menu / Notification Center
- All right-click context menus
- App indicator menus
- PopupSubMenus

**One implementation → 5+ blur targets.**

### No C Patches Needed

All identified targets are feasible via **JS extension only**. Every unblurred actor supports `add_effect()` and `Shell.BlurEffect` in `BACKGROUND` mode.

### Priority Matrix

| Rank | Target | Effort | Impact |
|------|--------|--------|--------|
| 1 | BoxPointer (covers Quick Settings, Date Menu, all menus) | Medium | Very High |
| 2 | OSD Windows | Low | Medium |
| 3 | Modal Dialogs (covers all dialog types) | Medium | High |
| 4 | Notification Banners | High | Medium |
| 5 | Workspace Switcher | Low | Low |

## Files Produced

- `03-RESEARCH.md` — Complete actor inventory with class hierarchies, access paths, lifecycle analysis, and feasibility assessment
- `03-SUMMARY.md` — This summary
