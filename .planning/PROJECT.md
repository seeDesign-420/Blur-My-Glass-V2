# blur-my-glass

## What This Is

A patched GNOME Shell package that adds rounded blur masking and liquid glass refraction effects to Mutter's `ShellBlurEffect`. Ships as an Arch Linux PKGBUILD that replaces the system `gnome-shell` package.

## Core Value

Enable frosted-glass blur with proper rounded corners on GNOME/Wayland — something the upstream compositor doesn't support natively.

## Context

- **Platform:** Arch Linux, GNOME 50, Mutter 18 API, Wayland
- **Architecture:** Source-level C patches applied to `shell-blur-effect.c` at build time
- **Consumers:** blur-my-shell extension (sets `corner-radius` property via GObject)
- **Two patch variants:** rounded corners mask (stable) and liquid glass compositor (experimental)

## Current Milestone: v1.2 — Broad Shell Overlay Glass

**Goal:** Add blur/glass treatment to broad GNOME Shell overlays that currently show unblurred or poorly integrated backgrounds.

**Target features:**
- Date/calendar menu glass blur
- Quick Settings glass blur
- Notification banners and notification list glass blur
- OSD glass blur
- Desktop context menu glass blur
- Application and jump-list menu glass blur where technically feasible

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| System package replacement | Enables C-level compositor modifications impossible in pure JS extensions |
| SDF-based masking | Anti-aliased rounded corners without texture-based masks |
| Cogl snippet injection | Uses `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP` for UV-level refraction |
| Stacked patches (v1.0) | Eliminates duplicated mask logic, simplifies maintenance |
| Repair current `ShellBlurEffect` patch (v1.1) | Keeps compositor-level integration and avoids a wholesale port to a separate `Clutter.ShaderEffect` stack |
| Broad overlay-first rollout (v1.2) | Prioritizes visible GNOME shell surfaces with highest user impact before vibrancy tuning |

## Active Requirements

See `REQUIREMENTS.md` for v1.2 requirements.

## Validated Requirements

*(None yet — first milestone)*

## Out of Scope

- Multi-distro support (Arch-only for now)
- Runtime shader switching (patches are compile-time)
- Upstream contribution (patches are too invasive for upstream)
- Full port of the reference `liquid-glass` extension shader stack during v1.2

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-22*
