# Milestones

## Status Summary

| Version | Name | Status | Notes |
|---------|------|--------|-------|
| v1.0 | Anti-Aliased Unified Patches | Previous work, verification pending | Earlier patch phases exist; verification is still pending. |
| v1.1 | Refraction Edge Anti-Aliasing | Previous work, verification pending | Patch update applied and prepare checks pass; runtime visual verification still pending. |
| v1.2 | Broad Shell Overlay Glass | Active | Add blur/glass treatment to broad GNOME Shell overlays using `liquid-glass` as a reference project. |
| v1.3 | Vibrant Brightness Tuning | Upcoming | Improve perceived brightness and vibrancy beyond the current multiplicative brightness control. |

## v1.0 - Anti-Aliased Unified Patches

**Status:** Previous work, verification pending.

**Goal:** Fix aliased SDF mask edges in the rounded corners patch and restructure both patches into a stacked base + overlay system.

**Delivered/planned phases:**
- Phase 1: SDF anti-aliasing fix
- Phase 2: Stacked patch architecture
- Phase 3: Actor coverage audit
- Phase 4: BoxPointer blur component
- Phase 5: Build verification

## v1.1 - Refraction Edge Anti-Aliasing

**Status:** Previous work, verification pending.

**Goal:** Repair liquid-glass refraction edge artifacts while keeping the existing `ShellBlurEffect` C patch architecture.

**Target features:**
- Smooth refraction edges on rounded corners and small top-panel/dock surfaces
- Safe texture sampling near rounded corners and clipped blur actors
- Derivative-safe anti-aliasing for high-contrast refraction boundaries
- No regression to the base rounded mask patch or extension-side refraction settings

**Pending:** Runtime visual verification is still required to confirm artifact fixes on-shell.

## v1.2 - Broad Shell Overlay Glass

**Status:** Active.

**Goal:** Add blur/glass treatment to broad GNOME Shell overlays that currently show unblurred or poorly integrated backgrounds.

**Target features:**
- Date/calendar menu glass blur
- Quick Settings glass blur
- Notification banners and notification list glass blur
- OSD glass blur
- Desktop context menu glass blur
- Application and jump-list menu glass blur where technically feasible

**Reference:** `https://github.com/ryohsuke1231/liquid-glass`

## v1.3 - Vibrant Brightness Tuning

**Status:** Upcoming.

**Goal:** Improve the perceived brightness, vibrancy, and readability of blur surfaces beyond the current multiplicative brightness slider.

**Target features:**
- More vibrant blur output without washing out text
- Better visual range for the brightness preference
- Compatibility with existing blur components and liquid-glass refraction settings
