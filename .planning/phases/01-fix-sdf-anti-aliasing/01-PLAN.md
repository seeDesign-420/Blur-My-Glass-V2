---
phase: 1
name: "Fix SDF Anti-Aliasing"
wave: 1
depends_on: []
requirements: [SDF-01, SDF-02, SDF-03]
files_modified:
  - patches/rounded_corners_mask.patch
autonomous: true
---

# Plan 01: Anti-Alias the SDF Rounded Corners Mask

<objective>
Fix the aliased hard edges in the rounded corners mask by correcting the SDF distance function and replacing `step()` with `smoothstep()` using screen-space derivatives.
</objective>

<context>
The current `mask_glsl` shader in `patches/rounded_corners_mask.patch` has two bugs:

1. **Incomplete SDF**: The signed distance to a rounded rect should be:
   ```glsl
   float dist = min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - radius;
   ```
   The `min(max(q.x, q.y), 0.0)` interior term is missing, causing incorrect distances for pixels well inside the shape.

2. **Hard mask edge**: `step(dist, 0.0)` produces a binary 0/1 mask — pixels are either fully visible or fully clipped with no sub-pixel transition. This creates jagged, aliased edges.

The liquid glass patch already has the correct implementation. This is a direct backport.
</context>

<tasks>

<task id="01" type="execute">
<title>Fix SDF distance and add anti-aliasing to mask_glsl</title>

<read_first>
- patches/rounded_corners_mask.patch (current shader code, lines 15-26)
- patches/liquid_glass_compositor.patch (reference correct implementation)
</read_first>

<action>
Edit `patches/rounded_corners_mask.patch`, replacing the `mask_glsl` shader string (lines 19-26) with the corrected version.

**Current code (lines 19-26):**
```
+static const gchar *mask_glsl =
+"  vec2 uv = cogl_tex_coord_in[0].st;                                      \n"
+"  vec2 p  = uv * u_size;                                                  \n"
+"  vec2 q  = abs(p - 0.5 * u_size) - (0.5 * u_size - u_corner_radius);     \n"
+"  float dist = length(max(q, vec2(0.0))) - u_corner_radius;               \n"
+"  float m = step(dist, 0.0);                                              \n"
+"  cogl_color_out.rgb *= m;                                                \n"
+"  cogl_color_out.a   *= m;                                                \n";
```

**Replace with:**
```
+static const gchar *mask_glsl =
+"  vec2 uv = cogl_tex_coord_in[0].st;                                      \n"
+"  vec2 p  = uv * u_size;                                                  \n"
+"  vec2 q  = abs(p - 0.5 * u_size) - (0.5 * u_size - u_corner_radius);     \n"
+"  float dist = min(max(q.x, q.y), 0.0)                                    \n"
+"             + length(max(q, vec2(0.0))) - u_corner_radius;               \n"
+"  float aa = max(fwidth(dist), 0.75);                                     \n"
+"  float m = smoothstep(aa, -aa, dist);                                    \n"
+"  cogl_color_out.rgb *= m;                                                \n"
+"  cogl_color_out.a   *= m;                                                \n";
```

**Three changes:**
1. **SDF-01**: Split `dist` across two lines, adding `min(max(q.x, q.y), 0.0) +` before the existing `length(...)` term
2. **SDF-02**: Replace `float m = step(dist, 0.0);` with `float m = smoothstep(aa, -aa, dist);`
3. **SDF-03**: Add `float aa = max(fwidth(dist), 0.75);` — the `0.75` floor prevents pixel-thin artifacts when `fwidth()` returns very small values on large flat surfaces
</action>

<acceptance_criteria>
- patches/rounded_corners_mask.patch contains `min(max(q.x, q.y), 0.0)` in the mask_glsl string
- patches/rounded_corners_mask.patch contains `fwidth(dist)` in the mask_glsl string
- patches/rounded_corners_mask.patch contains `smoothstep(aa, -aa, dist)` in the mask_glsl string
- patches/rounded_corners_mask.patch contains `max(fwidth(dist), 0.75)` in the mask_glsl string
- patches/rounded_corners_mask.patch does NOT contain `step(dist, 0.0)` in the mask_glsl string
- The `mask_glsl_declarations` remain unchanged (u_corner_radius, u_size uniforms)
- All other hunks in the patch remain unchanged
</acceptance_criteria>
</task>

</tasks>

<verification>
After editing the patch file, verify with:
1. `grep 'min(max(q.x, q.y), 0.0)' patches/rounded_corners_mask.patch` — returns match
2. `grep 'smoothstep(aa, -aa, dist)' patches/rounded_corners_mask.patch` — returns match
3. `grep 'max(fwidth(dist), 0.75)' patches/rounded_corners_mask.patch` — returns match
4. `grep 'step(dist, 0.0)' patches/rounded_corners_mask.patch` — returns NO match
5. `wc -l patches/rounded_corners_mask.patch` — should be ~325 lines (±3 from the 322 original)
</verification>

<must_haves>
- Correct SDF box distance with interior term
- Anti-aliased edges via smoothstep + fwidth
- Minimum AA width floor (0.75) to prevent artifacts
- No changes to anything outside the mask_glsl shader string
</must_haves>
