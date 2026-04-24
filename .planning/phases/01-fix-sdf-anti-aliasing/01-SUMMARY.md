# Phase 1: Fix SDF Anti-Aliasing — Summary

## What Changed

**File:** `patches/rounded_corners_mask.patch` (lines 19-28 of the `mask_glsl` shader string)

### Before
```glsl
float dist = length(max(q, vec2(0.0))) - u_corner_radius;
float m = step(dist, 0.0);
```

### After
```glsl
float dist = min(max(q.x, q.y), 0.0)
           + length(max(q, vec2(0.0))) - u_corner_radius;
float aa = max(fwidth(dist), 0.75);
float m = smoothstep(aa, -aa, dist);
```

## Requirements Addressed

| REQ | Status | Detail |
|-----|--------|--------|
| SDF-01 | ✅ | Interior SDF term `min(max(q.x, q.y), 0.0)` added |
| SDF-02 | ✅ | `smoothstep()` with `fwidth()` replaces `step()` |
| SDF-03 | ✅ | `0.75` minimum floor on AA width |

## Self-Check: PASSED

- `min(max(q.x, q.y), 0.0)` present: ✅
- `fwidth(dist)` present: ✅
- `smoothstep(aa, -aa, dist)` present: ✅
- `max(fwidth(dist), 0.75)` present: ✅
- `step(dist, 0.0)` removed: ✅
- Declarations unchanged: ✅
- Other patch hunks unchanged: ✅
- Line count: 323 (was 322, +1 from split dist line)
