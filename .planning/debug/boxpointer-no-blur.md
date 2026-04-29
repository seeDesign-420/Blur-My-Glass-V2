---
status: fixing
trigger: "Boxpointer blur actors not rendering — zero allocation errors"
created: 2026-04-26T20:55:00+02:00
updated: 2026-04-27T07:11:00+02:00
---

# Debug: BoxPointer Blur Not Rendering

## Root Cause (Confirmed)

**BoxPointer.vfunc_allocate() only allocates two children: `_border` and `bin`.**

When the blur component inserts a `Meta.BackgroundGroup` as a child of the BoxPointer at index 0, the custom `vfunc_allocate()` in `boxpointer.js` (GNOME Shell source, line 229-268) never calls `.allocate()` on it. Mutter logs repeated warnings:

```
Can't update stage views actor bms-boxpointer-backgroundgroup [MetaBackgroundGroup]
is on because it needs an allocation.
```

The blur actors are present in the actor tree but render as 0×0 invisible widgets.

### Why the Panel works but BoxPointer doesn't

- **Panel**: `background_group` is inserted into `panel_box` (an `St.BoxLayout`) which has **default allocation** that sizes all children.
- **BoxPointer**: extends `St.Widget` with a **custom `vfunc_allocate`** that explicitly only allocates `_border` and `bin`. Foreign children are ignored.

## Fix Applied

Rewrote `_blur_boxpointer()` to use a **sibling approach**:

1. Create a wrapper `St.Widget` instead of inserting into the BoxPointer
2. Insert the wrapper into the BoxPointer's **parent** container using `parent.insert_child_below(wrapper, boxpointer)`
3. Attach `Clutter.BindConstraint` for both POSITION and SIZE to automatically track the BoxPointer
4. The wrapper's children (background_group, background) are allocated normally by the wrapper's default allocation logic

**File changed**: `~/.local/share/gnome-shell/extensions/blur-my-shell@aunetx/components/boxpointer.js`

## Verification

- [ ] Open a popup menu (right-click, Quick Settings, etc.)
- [ ] Confirm blur is visible behind the popup
- [ ] Check `journalctl --user -b | grep bms-boxpointer` for absence of "needs an allocation" errors
- [ ] Close popup and confirm no orphaned actors remain
