# Roadmap - v1.2 Broad Shell Overlay Glass

## Milestone Goal

Add blur/glass treatment to broad GNOME Shell overlays that currently show unblurred or poorly integrated backgrounds.

## Phase 8: Broad Overlay Blur Integration

**Goal:** Implement broad shell overlay blur coverage for date/calendar, Quick Settings, notifications, OSD, desktop menus, and application/jump-list menus with stable lifecycle behavior.

**Requirements:** OVR-01, OVR-02, OVR-03, OVR-04, OVR-05, OVR-06, LIFE-01, LIFE-02, LIFE-03, CFG-01, CFG-02, CFG-03

**Changes:**
- Extension overlay components and manager wiring for broad shell menu surfaces.
- Settings and preferences integration for overlay blur behavior following existing component patterns.
- Reference-informed behavior from `liquid-glass` where compatible with current architecture.

**Success criteria:**
1. Date/calendar and Quick Settings overlays visually render blur/glass behind content without clipping failures.
2. Notifications and OSD overlays render blur/glass and clean up correctly after close.
3. Desktop menus and application/jump-list menus receive blur/glass where actor structure supports safe attachment.
4. Repeated open/close cycles do not leak actors or leave stale signal connections.
5. Existing components retain current behavior and settings semantics.
6. Visual readability remains acceptable on mixed bright/dark backgrounds with default values.

## Traceability

| Phase | Requirements | Status |
|-------|--------------|--------|
| 8 | OVR-01, OVR-02, OVR-03, OVR-04, OVR-05, OVR-06, LIFE-01, LIFE-02, LIFE-03, CFG-01, CFG-02, CFG-03 | Planned |
