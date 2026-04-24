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

## Current Milestone: v1.0 — Anti-Aliased Unified Patches

**Goal:** Fix aliased SDF mask edges in the rounded corners patch and restructure both patches into a stacked base + overlay system.

**Target features:**
- Anti-aliased rounded corners using `smoothstep()` + `fwidth()` instead of `step()`
- Correct SDF box distance function (add missing interior term)
- Stacked patch architecture: base patch (mask) + overlay patch (refraction)
- Single source of truth for shared mask logic

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| System package replacement | Enables C-level compositor modifications impossible in pure JS extensions |
| SDF-based masking | Anti-aliased rounded corners without texture-based masks |
| Cogl snippet injection | Uses `COGL_SNIPPET_HOOK_TEXTURE_LOOKUP` for UV-level refraction |
| Stacked patches (v1.0) | Eliminates duplicated mask logic, simplifies maintenance |

## Active Requirements

See `REQUIREMENTS.md` for v1.0 requirements.

## Validated Requirements

*(None yet — first milestone)*

## Out of Scope

- Multi-distro support (Arch-only for now)
- Runtime shader switching (patches are compile-time)
- Upstream contribution (patches are too invasive for upstream)

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
*Last updated: 2026-04-24*
