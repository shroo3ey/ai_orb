# AI Agent Orb — Design Spec

**Date:** 2026-04-17
**Status:** Approved for planning

## Summary

A 3D volumetric particle-cloud orb rendered with Three.js + GLSL shaders, used as a visual state indicator for an AI agent. The orb is a translucent shell of 8000 additively-blended points arranged on a sphere with shell depth, animated by curl-noise turbulence and a slow orbital drift. Four states (idle, conscious, subconscious, transitioning) blend smoothly via a single lerped `uState` uniform that drives color, motion, and turbulence simultaneously.

## Goals

- Feel alive, organic, and dusty — "a mind thinking through frosted glass."
- Cleanly expose a React component (`<AgentOrb state="..." />`) that can drop into a real AI agent UI later.
- Hold 60 fps on a mid-range laptop with 8000 particles and retina DPR capped at 2.
- Zero post-processing: all softness comes from additive blending + per-particle alpha falloff.

## Non-goals

- No bloom, scan lines, grids, or "holographic AI" tropes.
- No responsive breakpoints beyond canvas resize (this is a single visual element).
- No server-side rendering of the canvas (Three.js is client-only).
- No audio, physics, or interactivity beyond the `state` prop.

## Architecture

```
src/
  components/
    AgentOrb/
      AgentOrb.tsx          # React wrapper, 'use client'
      orb-scene.ts          # Pure-TS scene builder; no React
      orb.vert.glsl.ts      # Vertex shader (template string)
      orb.frag.glsl.ts      # Fragment shader (template string)
      noise.glsl.ts         # Shared simplex/curl noise GLSL chunk
  app/
    orb/
      page.tsx              # Demo route: full-viewport orb + state buttons
```

**Separation rationale:** `orb-scene.ts` is framework-agnostic and holds all Three.js state. `AgentOrb.tsx` is a thin React shell that mounts the scene into a ref'd `<div>`, forwards the `state` prop via `scene.setState()`, and calls `scene.dispose()` on unmount. This keeps Three.js off React's render path and makes the scene unit-testable (or portable to another framework) without rewrites.

## Public API

```tsx
type OrbState = "idle" | "conscious" | "subconscious" | "transitioning";

<AgentOrb state="idle" />
```

**Single prop.** When `state` changes between `idle`/`conscious`/`subconscious`, the component internally plays `transitioning` for ~0.7s as a burst effect, then settles into the target. So callers only need to toggle between the three semantic states; the scatter-and-return burst comes for free. Passing `state="transitioning"` explicitly is allowed (used by the demo page for manual preview) and holds the burst indefinitely until the next prop change.

**Internal state mapping:**
- `idle` → `uState` target = 0
- `conscious` → 1
- `subconscious` → 2
- `transitioning` → 3

## Geometry

**BufferGeometry with 8000 points.** Per-particle attributes:

| Attribute         | Type   | Purpose                                                  |
|-------------------|--------|----------------------------------------------------------|
| `position`        | vec3   | Rest position on sphere (sampled once, never mutated)    |
| `aSeed`           | float  | Random 0-1 per particle for size/color/phase variation   |
| `aRadialOffset`   | float  | Signed offset from sphere surface ∈ [-0.15, 0.05]        |
| `aPhase`          | float  | Random orbit phase offset 0-2π                           |

**Distribution:** uniform on unit sphere via the standard `(θ = 2π·u, φ = acos(2v-1))` trick. Radial offset is sampled with a density bias toward the surface: `r = 1 + aRadialOffset` where `aRadialOffset ~ pow(random, 2) * 0.2 - 0.15` (most particles sit near the surface, with a thin inner halo). This gives the "shell with depth" look, not a solid ball.

**Edge feathering:** computed in the vertex shader and passed as `vEdgeFade` varying. Formula: `vEdgeFade = smoothstep(0.20, 0.02, abs(aRadialOffset))` — particles at the sphere surface (`aRadialOffset ≈ 0`) get full opacity, particles in the inner halo or near the outer edge fade out smoothly. Combined with the density bias (most particles spawn near the surface), this gives the soft feathered sphere boundary.

## Shader strategy

### Uniforms (shared)

| Uniform              | Type  | Notes                                               |
|----------------------|-------|-----------------------------------------------------|
| `uTime`              | float | Seconds since mount                                 |
| `uState`             | float | Lerped ∈ [0, 3], NOT snapped                        |
| `uPixelRatio`        | float | `min(devicePixelRatio, 2)`                          |
| `uSize`              | float | Base point size in pixels (≈2)                      |
| `uColorBase`         | vec3  | #FFFFFF (idle)                                      |
| `uColorConscious`    | vec3  | Desaturated #1D9E75 — mostly white, green highlights |
| `uColorSubconscious` | vec3  | Desaturated #7F77DD — mostly white, purple highlights|

### Vertex shader

1. Compute animated position:
   - `p = position` (rest)
   - Apply slow orbital drift: rotate `p` around Y axis by `uTime * orbitSpeed(uState) + aPhase * 0.1`
   - Add curl-noise displacement: `p += curlNoise(p * freq + uTime * noiseSpeed(uState)) * turbulenceAmp(uState)`
   - Apply radial breathing: `p *= 1 + breathingFn(uTime, uState)`, computed as a weighted sum of per-state terms:
     - idle term: `sin(uTime * 0.8) * 0.03`
     - conscious term: `sin(uTime * 2.5) * 0.04` (radial pulse)
     - subconscious term: `sin(uTime * 0.5) * 0.08` (slow deep swell)
     - transitioning term: steady outward `+0.15` (not time-varying — the "return" is the natural consequence of uState lerping back toward 0/1/2 after the auto-burst ends)
2. Output `gl_Position` via standard projection chain.
3. Output `gl_PointSize = uSize * uPixelRatio * (0.5 + aSeed * 0.5) * (1.0 / -viewPos.z) * 300.0` — depth-scaled and seed-varied (1-3px range).
4. Pass varyings to fragment: `vSeed`, `vDepth` (normalized 0-1 with 0 = far), `vEdgeFade` (from radial offset).

### Fragment shader

```glsl
void main() {
  // Soft circular point
  vec2 coord = gl_PointCoord - vec2(0.5);
  float d = length(coord);
  float alpha = smoothstep(0.5, 0.15, d);

  // Brightness: brighter particles get tinted; dim ones stay white
  float brightness = vDepth * (0.5 + vSeed * 0.5);

  // Color mixing driven by uState weights (smoothstep gating per state)
  float wIdle     = clamp(1.0 - abs(uState - 0.0), 0.0, 1.0);
  float wConsc    = clamp(1.0 - abs(uState - 1.0), 0.0, 1.0);
  float wSubc     = clamp(1.0 - abs(uState - 2.0), 0.0, 1.0);
  float wTrans    = clamp(1.0 - abs(uState - 3.0), 0.0, 1.0);
  // Weights always sum to 1 along a linear path through the states.

  vec3 tint = uColorBase * wIdle
            + mix(uColorBase, uColorConscious, brightness) * wConsc
            + mix(uColorBase, uColorSubconscious, brightness) * wSubc
            + uColorBase * wTrans;

  gl_FragColor = vec4(tint, alpha * vEdgeFade * brightness);
}
```

All state-varying parameters (orbit speed, turbulence amplitude, breathing frequency) are computed in the **vertex** shader using the same `wIdle/wConsc/wSubc/wTrans` weights, so there are no conditional branches — just smooth blends.

### Curl noise

Implemented via 3D simplex noise (`snoise`, Ashima/Stefan Gustavson port, ~60 lines of GLSL) wrapped in a curl approximation:

```glsl
vec3 curl(vec3 p) {
  const float e = 0.01;
  float n1 = snoise(p + vec3(0, e, 0));
  // ... 5 more samples with offsets ...
  return normalize(vec3(
    (n_yz_plus - n_yz_minus),
    (n_zx_plus - n_zx_minus),
    (n_xy_plus - n_xy_minus)
  )) / (2.0 * e);
}
```

6 noise samples per vertex per frame. At 8000 vertices × 60 fps = 2.88M snoise evaluations/sec — well within budget.

## State-specific parameters

| Parameter           | Idle (0)     | Conscious (1)  | Subconscious (2) | Transitioning (3) |
|---------------------|--------------|----------------|------------------|-------------------|
| Orbit speed         | 0.02 rad/s   | 0.15 rad/s     | 0.06 rad/s       | 0.10 rad/s        |
| Turbulence amp      | 0.015        | 0.05           | 0.12             | 0.20              |
| Noise frequency     | 1.0          | 1.8            | 0.6              | 2.5               |
| Breathing freq      | 0.8 rad/s    | 2.5 rad/s      | 0.5 rad/s        | —                 |
| Breathing amp       | 0.03         | 0.04           | 0.08             | 0.15 (constant outward) |
| Tint color          | white        | desat green    | desat purple     | white             |

Desaturated color values (pick in sRGB, convert to linear for shader):
- `uColorConscious` = `#B8D8C9` (mostly white with a green whisper)
- `uColorSubconscious` = `#C8C4DD` (mostly white with a violet whisper)

These are dialed desaturation/lightness shifts of the reference hex codes, tuned so that the color only reads in the brighter particles — the bulk of the cloud stays monochrome per the "mostly still white" instruction.

## State transitions

**Single lerped uniform.** `uState` is a JS-side float that eases toward its target each frame:

```ts
uState += (target - uState) * (1 - exp(-deltaTime / tau));  // tau ≈ 0.45s → ~1.5s full settle
```

**Auto-transition burst:** When the React `state` prop changes from one of {idle, conscious, subconscious} to another:
1. Immediately set target = 3 (transitioning).
2. After 0.7s, set target = (final state's number).
3. Total perceived transition: ~1.5s (0.7s scatter + 0.8s settle as the lerp converges).

If `state="transitioning"` is passed explicitly, target stays at 3 until the next prop change.

## Camera and renderer

- `PerspectiveCamera(fov=45, aspect=w/h, near=0.1, far=100)`, positioned at `(0, 0, 3)` looking at origin.
- Slow auto-rotation: orbit camera around Y axis at 0.05 rad/s.
- Orb radius = 1. At z=3 with fov=45, orb occupies ~60-65% of shorter canvas dimension — matches spec.
- `WebGLRenderer({ antialias: false, alpha: false })` — solid black clear color, no AA needed since points are soft.
- `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`.
- Single `requestAnimationFrame` loop; cleaned up on unmount.

## Demo page (`src/app/orb/page.tsx`)

- Full-viewport black background.
- `<AgentOrb state={state} />` filling the viewport.
- Four buttons bottom-center (`idle`, `conscious`, `subconscious`, `transitioning`), minimal styling (thin white text, subtle underline on active). Tailwind classes.
- React `useState` holds current state.
- `'use client'` directive.

## Next.js 16 + React 19 considerations

- `AgentOrb.tsx` and `orb/page.tsx` both need `'use client'` — Three.js requires `window`.
- Three.js imported normally (`import * as THREE from 'three'`) — Next 16 handles client-only bundling automatically when inside a client component. No `next/dynamic` needed.
- Add `three` and `@types/three` to dependencies.
- **Before writing any code**, check `node_modules/next/dist/docs/01-app/` for any client-component / effect / lifecycle changes specific to Next 16 or React 19 that could affect mount/unmount semantics.

## Performance budget

- 8000 points, 1 draw call, additive blending.
- Shader cost per frame ≈ 8000 × (6 snoise + projection) ≈ well under 1ms on integrated GPUs.
- Memory: ~200 KB for attributes (4 floats × 8000 + vec3 × 8000).
- No garbage in the animation loop — reuse Vector3/Color objects.

## Testing

- Visual smoke test via demo page — verify each of the four states reads distinctly and transitions feel smooth.
- Manual verification targets:
  - Idle: barely-visible breathing, mostly monochrome.
  - Conscious: visible swirling currents + periodic radial pulse + green whisper.
  - Subconscious: slow deep swell, more chaotic turbulence, violet whisper.
  - Transitioning: brief scatter burst, returns cleanly.
- No unit tests — this is pure visual output and shader behavior; automated testing has poor ROI here.

## Open decisions

None as of approval.

## Risks

1. **Three.js peer-dep friction with Next 16 / React 19.** Mitigation: pin to a known-good three version (latest 0.170+), test install early.
2. **Curl noise tuning.** The turbulence amplitudes in the state table are first-pass estimates. Expect to tweak values visually during implementation — this is shader art, not specs-driven coding.
3. **Color readability.** The "mostly white with a color whisper" constraint is subtle. May need iteration on desaturated hex values after visual review.
