# AI Agent Orb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Three.js + GLSL particle-cloud orb exposed as `<AgentOrb state="..." />`, with four visual states (idle / conscious / subconscious / transitioning) that blend smoothly via a single lerped uniform.

**Architecture:** Plain-TS scene builder (`orb-scene.ts`) owns all Three.js state and the animation loop. Thin React wrapper (`AgentOrb.tsx`) forwards the `state` prop via `scene.setState()`. Shaders live as template-string modules (`.glsl.ts`) — no webpack loader needed. A demo route at `/orb` provides buttons to manually select each state.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Three.js (latest stable, 0.170+), GLSL (custom ShaderMaterial), Tailwind CSS 4.

**Design doc:** [`docs/superpowers/specs/2026-04-17-ai-agent-orb-design.md`](../specs/2026-04-17-ai-agent-orb-design.md)

**Testing note:** Per the design spec, this is pure visual output — no unit tests. Verification is dev-server + manual visual inspection of all four states and transitions. Each task below ends with a build check (where possible) and the final task is a structured visual QA pass.

---

## File structure

```
src/
  components/
    AgentOrb/
      AgentOrb.tsx          # React wrapper (client component)
      orb-scene.ts          # Scene/geometry/material/loop (pure TS)
      noise.glsl.ts         # snoise3 + curl noise GLSL chunk
      orb.vert.glsl.ts      # Vertex shader
      orb.frag.glsl.ts      # Fragment shader
  app/
    orb/
      page.tsx              # Demo page with state buttons
```

---

## Task 1: Install Three.js dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime + type deps**

Run:
```bash
cd k:/_dev/ai_orb && npm install three && npm install --save-dev @types/three
```

Expected: both installed successfully, `package.json` updated.

- [ ] **Step 2: Verify install**

Run:
```bash
cd k:/_dev/ai_orb && node -e "console.log(require('three').REVISION)"
```

Expected: prints a revision number (e.g., `170` or higher). If Three.js reports a major version difference from `0.170+`, note it but proceed — the APIs we use (BufferGeometry, ShaderMaterial, Points, WebGLRenderer, PerspectiveCamera) have been stable for years.

- [ ] **Step 3: Commit**

```bash
cd k:/_dev/ai_orb && git add package.json package-lock.json && git commit -m "chore: add three and @types/three"
```

---

## Task 2: Verify Next.js 16 client-component story

**Files:** None (read-only research)

AGENTS.md says this is not the Next.js in your training data. Before writing a client component, confirm that the standard `'use client'` directive still works the way we expect in Next 16 and note any deprecations.

- [ ] **Step 1: Read Next 16 client-components guide**

Read both:
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`

- [ ] **Step 2: Note any surprises**

Specifically check for:
- Is `'use client'` still the directive? (Should be yes.)
- Any changes to `useEffect` mount/unmount semantics under React 19.
- Any changes to how client components can be imported from server components.
- Deprecation notices on anything we'll use (refs, useEffect, useState).

If anything is different from a normal App Router client component setup, document the deviation in a comment at the top of `AgentOrb.tsx` in Task 8. If everything is standard, proceed with no changes.

---

## Task 3: Create noise.glsl.ts (simplex + curl)

**Files:**
- Create: `src/components/AgentOrb/noise.glsl.ts`

- [ ] **Step 1: Write the file**

Create `src/components/AgentOrb/noise.glsl.ts`:

```ts
// Ashima / Stefan Gustavson 3D simplex noise (snoise), plus a curl approximation
// built from finite differences of snoise. Exported as a GLSL chunk string to
// concatenate into vertex/fragment shaders.

export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Curl approximation built from finite differences of a single noise field.
// Produces a divergence-free-ish vector field — good enough for swirling
// particle motion, much cheaper than three independent potentials.
vec3 curl(vec3 p) {
  const float e = 0.1;
  float nx1 = snoise(p + vec3(e, 0.0, 0.0));
  float nx0 = snoise(p - vec3(e, 0.0, 0.0));
  float ny1 = snoise(p + vec3(0.0, e, 0.0));
  float ny0 = snoise(p - vec3(0.0, e, 0.0));
  float nz1 = snoise(p + vec3(0.0, 0.0, e));
  float nz0 = snoise(p - vec3(0.0, 0.0, e));

  float dx = (nx1 - nx0) / (2.0 * e);
  float dy = (ny1 - ny0) / (2.0 * e);
  float dz = (nz1 - nz0) / (2.0 * e);

  return vec3(dy - dz, dz - dx, dx - dy);
}
`;
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd k:/_dev/ai_orb && npx tsc --noEmit
```

Expected: no errors. (The file only exports a string; the GLSL contents aren't checked at this stage.)

- [ ] **Step 3: Commit**

```bash
cd k:/_dev/ai_orb && git add src/components/AgentOrb/noise.glsl.ts && git commit -m "feat(orb): add simplex + curl noise GLSL chunk"
```

---

## Task 4: Create orb.vert.glsl.ts (vertex shader)

**Files:**
- Create: `src/components/AgentOrb/orb.vert.glsl.ts`

The vertex shader handles all motion — rest position + Y-axis orbit + curl turbulence + radial breathing. All per-state parameters are computed as weighted blends of four state weights (`wIdle, wCons, wSubc, wTran`), so there are no conditional branches.

- [ ] **Step 1: Write the file**

Create `src/components/AgentOrb/orb.vert.glsl.ts`:

```ts
import { NOISE_GLSL } from './noise.glsl';

export const VERTEX_SHADER = /* glsl */ `
${NOISE_GLSL}

attribute float aSeed;
attribute float aRadialOffset;
attribute float aPhase;

uniform float uTime;
uniform float uState;
uniform float uPixelRatio;
uniform float uSize;

varying float vSeed;
varying float vDepth;
varying float vEdgeFade;

vec3 rotateY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
  // Per-state weights (1 at state's integer, 0 one unit away, linear).
  float wIdle = clamp(1.0 - abs(uState - 0.0), 0.0, 1.0);
  float wCons = clamp(1.0 - abs(uState - 1.0), 0.0, 1.0);
  float wSubc = clamp(1.0 - abs(uState - 2.0), 0.0, 1.0);
  float wTran = clamp(1.0 - abs(uState - 3.0), 0.0, 1.0);

  // Motion parameters as weighted blends.
  float orbitSpeed = 0.02 * wIdle + 0.15 * wCons + 0.06 * wSubc + 0.10 * wTran;
  float turbAmp    = 0.015 * wIdle + 0.05 * wCons + 0.12 * wSubc + 0.20 * wTran;
  float noiseFreq  = 1.0 * wIdle + 1.8 * wCons + 0.6 * wSubc + 2.5 * wTran;
  float noiseSpeed = 0.3 * wIdle + 0.6 * wCons + 0.2 * wSubc + 0.8 * wTran;

  // Breathing (radial scale modulation).
  float breathIdle = sin(uTime * 0.8) * 0.03;
  float breathCons = sin(uTime * 2.5) * 0.04;
  float breathSubc = sin(uTime * 0.5) * 0.08;
  float breathTran = 0.15;
  float breath = breathIdle * wIdle + breathCons * wCons + breathSubc * wSubc + breathTran * wTran;

  vec3 p = position;

  // Slow orbital drift around Y, with a small per-particle phase offset.
  p = rotateY(p, uTime * orbitSpeed + aPhase * 0.1);

  // Curl-noise turbulence.
  vec3 noisePos = p * noiseFreq + vec3(uTime * noiseSpeed);
  p += curl(noisePos) * turbAmp;

  // Radial breathing / scatter.
  p *= (1.0 + breath);

  // Project.
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // vDepth: 1.0 near (front of sphere, z≈2), 0.0 far (back, z≈4).
  float viewDist = -mvPosition.z;
  vDepth = clamp(1.0 - (viewDist - 2.0) / 2.0, 0.0, 1.0);

  // Point size: depth-scaled with per-particle seed variation.
  gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed * 0.8) * (300.0 / max(viewDist, 0.001));

  // Edge fade: particles near surface get full opacity, halo/edge fade.
  vEdgeFade = smoothstep(0.20, 0.02, abs(aRadialOffset));
  vSeed = aSeed;
}
`;
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd k:/_dev/ai_orb && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd k:/_dev/ai_orb && git add src/components/AgentOrb/orb.vert.glsl.ts && git commit -m "feat(orb): add vertex shader with state-weighted motion"
```

---

## Task 5: Create orb.frag.glsl.ts (fragment shader)

**Files:**
- Create: `src/components/AgentOrb/orb.frag.glsl.ts`

- [ ] **Step 1: Write the file**

Create `src/components/AgentOrb/orb.frag.glsl.ts`:

```ts
export const FRAGMENT_SHADER = /* glsl */ `
uniform float uState;
uniform vec3 uColorBase;
uniform vec3 uColorConscious;
uniform vec3 uColorSubconscious;

varying float vSeed;
varying float vDepth;
varying float vEdgeFade;

void main() {
  // Soft circular falloff via gl_PointCoord — no hard pixel edges.
  vec2 coord = gl_PointCoord - vec2(0.5);
  float d = length(coord);
  float alpha = smoothstep(0.5, 0.15, d);

  // Brightness drives how much of the tint color shows. Dim particles
  // stay white; only the bright ones reveal the state hue.
  float brightness = vDepth * (0.5 + vSeed * 0.5);

  // Same state weights as vertex shader.
  float wIdle = clamp(1.0 - abs(uState - 0.0), 0.0, 1.0);
  float wCons = clamp(1.0 - abs(uState - 1.0), 0.0, 1.0);
  float wSubc = clamp(1.0 - abs(uState - 2.0), 0.0, 1.0);
  float wTran = clamp(1.0 - abs(uState - 3.0), 0.0, 1.0);

  vec3 tint = uColorBase * wIdle
            + mix(uColorBase, uColorConscious, brightness) * wCons
            + mix(uColorBase, uColorSubconscious, brightness) * wSubc
            + uColorBase * wTran;

  gl_FragColor = vec4(tint, alpha * vEdgeFade * brightness);
}
`;
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd k:/_dev/ai_orb && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd k:/_dev/ai_orb && git add src/components/AgentOrb/orb.frag.glsl.ts && git commit -m "feat(orb): add fragment shader with soft point + state tint"
```

---

## Task 6: Create orb-scene.ts — geometry and material builders

**Files:**
- Create: `src/components/AgentOrb/orb-scene.ts`

This file will grow in Task 7 to include the scene factory. We build it in two steps so each increment is reviewable on its own.

- [ ] **Step 1: Write initial file**

Create `src/components/AgentOrb/orb-scene.ts`:

```ts
import * as THREE from 'three';
import { VERTEX_SHADER } from './orb.vert.glsl';
import { FRAGMENT_SHADER } from './orb.frag.glsl';

export type OrbState = 'idle' | 'conscious' | 'subconscious' | 'transitioning';

/**
 * Builds a BufferGeometry of `count` points distributed on a unit sphere
 * with a bias toward the surface. Each particle carries:
 *   - position: rest position
 *   - aSeed: random 0-1 for per-particle variation
 *   - aRadialOffset: signed offset from surface, used for edge feathering
 *   - aPhase: random 0-2π orbit phase
 */
export function createOrbGeometry(count: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const radialOffsets = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Uniform point on sphere: invert CDF.
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);

    // Radial offset biased toward the surface (most particles near r=1).
    // offsetRand^2 skews density; final offset ∈ [-0.15, 0.05].
    const offsetRand = Math.random();
    const offset = Math.pow(offsetRand, 2) * 0.2 - 0.15;
    const r = 1.0 + offset;

    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    seeds[i] = Math.random();
    radialOffsets[i] = offset;
    phases[i] = Math.random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aRadialOffset', new THREE.BufferAttribute(radialOffsets, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  return geometry;
}

/**
 * Creates the ShaderMaterial. Colors are in sRGB; Three.js will handle
 * conversion based on its output color space. The tints are already
 * heavily desaturated (see design spec) so they read as "white with a
 * whisper of color" not "green particles" / "purple particles".
 */
export function createOrbMaterial(pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uState: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uSize: { value: 2.0 },
      uColorBase: { value: new THREE.Color(0xffffff) },
      uColorConscious: { value: new THREE.Color(0xb8d8c9) },
      uColorSubconscious: { value: new THREE.Color(0xc8c4dd) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    transparent: true,
  });
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd k:/_dev/ai_orb && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd k:/_dev/ai_orb && git add src/components/AgentOrb/orb-scene.ts && git commit -m "feat(orb): add geometry and material builders"
```

---

## Task 7: Extend orb-scene.ts — scene factory with state machine

**Files:**
- Modify: `src/components/AgentOrb/orb-scene.ts` (append)

The factory owns the renderer, scene, camera, animation loop, and the state-lerp logic including the auto-burst for idle/conscious/subconscious transitions.

- [ ] **Step 1: Append to orb-scene.ts**

Append to `src/components/AgentOrb/orb-scene.ts` (after `createOrbMaterial`):

```ts
const STATE_TARGET: Record<OrbState, number> = {
  idle: 0,
  conscious: 1,
  subconscious: 2,
  transitioning: 3,
};

// During prop changes between semantic states we hold state=3 for this long,
// then let the lerp settle into the new target. Total perceived transition ≈1.5s.
const BURST_DURATION_MS = 700;

// Time constant for the uState lerp. ~0.45s gives a ~1.5s visual settle.
const LERP_TAU = 0.45;

const PARTICLE_COUNT = 8000;

export interface OrbScene {
  setState: (state: OrbState) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createOrbScene(container: HTMLElement): OrbScene {
  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setClearColor(0x000000, 1);
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const geometry = createOrbGeometry(PARTICLE_COUNT);
  const material = createOrbMaterial(pixelRatio);
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // State machine.
  let currentState: OrbState = 'idle';
  let currentTarget = 0;
  let stateUniform = 0;
  let burstEndTime = 0;
  let pendingSettleTarget: number | null = null;

  const startTime = performance.now();
  let lastFrame = startTime;
  let frameId = 0;

  const setState = (next: OrbState) => {
    if (next === currentState) return;
    const prev = currentState;
    currentState = next;

    if (next === 'transitioning') {
      // Explicit request — hold at 3, no auto-settle.
      currentTarget = 3;
      pendingSettleTarget = null;
      return;
    }

    if (prev !== 'transitioning') {
      // Semantic state -> semantic state: auto-burst through state 3.
      currentTarget = 3;
      burstEndTime = performance.now() + BURST_DURATION_MS;
      pendingSettleTarget = STATE_TARGET[next];
    } else {
      // Was explicitly held at transitioning; go straight to new target.
      currentTarget = STATE_TARGET[next];
      pendingSettleTarget = null;
    }
  };

  const animate = () => {
    frameId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.1); // cap dt to avoid jumps after tab-switch
    lastFrame = now;
    const elapsed = (now - startTime) / 1000;

    // After the burst, settle toward the real target.
    if (pendingSettleTarget !== null && now >= burstEndTime) {
      currentTarget = pendingSettleTarget;
      pendingSettleTarget = null;
    }

    // Exponential lerp toward target.
    stateUniform += (currentTarget - stateUniform) * (1 - Math.exp(-dt / LERP_TAU));

    material.uniforms.uTime.value = elapsed;
    material.uniforms.uState.value = stateUniform;

    // Slow camera orbit.
    const camAngle = elapsed * 0.05;
    camera.position.x = Math.sin(camAngle) * 3;
    camera.position.z = Math.cos(camAngle) * 3;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  };
  animate();

  const resize = (w: number, h: number) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  const dispose = () => {
    cancelAnimationFrame(frameId);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };

  return { setState, resize, dispose };
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd k:/_dev/ai_orb && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd k:/_dev/ai_orb && git add src/components/AgentOrb/orb-scene.ts && git commit -m "feat(orb): add scene factory with state machine and render loop"
```

---

## Task 8: Create AgentOrb.tsx (React wrapper)

**Files:**
- Create: `src/components/AgentOrb/AgentOrb.tsx`

- [ ] **Step 1: Write the file**

Create `src/components/AgentOrb/AgentOrb.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { createOrbScene, type OrbState } from './orb-scene';

export type { OrbState };

interface AgentOrbProps {
  state: OrbState;
}

export function AgentOrb({ state }: AgentOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ReturnType<typeof createOrbScene> | null>(null);

  // Mount scene once; state changes flow through the second effect.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = createOrbScene(container);
    sceneRef.current = scene;

    const handleResize = () => {
      scene.resize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setState(state);
  }, [state]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
cd k:/_dev/ai_orb && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd k:/_dev/ai_orb && git add src/components/AgentOrb/AgentOrb.tsx && git commit -m "feat(orb): add AgentOrb React wrapper"
```

---

## Task 9: Create demo page at /orb

**Files:**
- Create: `src/app/orb/page.tsx`

- [ ] **Step 1: Write the file**

Create `src/app/orb/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { AgentOrb, type OrbState } from '@/components/AgentOrb/AgentOrb';

const STATES: OrbState[] = ['idle', 'conscious', 'subconscious', 'transitioning'];

export default function OrbDemoPage() {
  const [state, setState] = useState<OrbState>('idle');

  return (
    <main className="fixed inset-0 bg-black">
      <AgentOrb state={state} />
      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-8">
        {STATES.map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={`font-mono text-sm tracking-wide transition-opacity ${
              state === s
                ? 'text-white underline underline-offset-4'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify `@/` alias**

Confirm `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }` — this is Next.js default.

Run:
```bash
cd k:/_dev/ai_orb && grep -n "@/" tsconfig.json || echo "NO @/ PATHS"
```

Expected: shows `"@/*": ["./src/*"]`. If missing, change the import to `'../../components/AgentOrb/AgentOrb'` before proceeding.

- [ ] **Step 3: Typecheck**

Run:
```bash
cd k:/_dev/ai_orb && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Build check**

Run:
```bash
cd k:/_dev/ai_orb && npm run build
```

Expected: build succeeds. The `/orb` route should appear in the output. If build fails with SSR-related errors (e.g., "window is not defined"), the `'use client'` directive may not be covering Three.js's module-level code — check that both `AgentOrb.tsx` and `page.tsx` have `'use client'` at the top.

- [ ] **Step 5: Commit**

```bash
cd k:/_dev/ai_orb && git add src/app/orb/page.tsx && git commit -m "feat(orb): add /orb demo page with state buttons"
```

---

## Task 10: Visual verification and tuning

**Files:** None (visual QA). Tweaks to shaders/params go in their respective files if needed.

This is the real verification step. Shader art isn't right until it looks right.

- [ ] **Step 1: Start dev server**

Run (in background):
```bash
cd k:/_dev/ai_orb && npm run dev
```

Expected: server starts on `http://localhost:3000` (or 3001 if 3000 busy). No errors in console.

- [ ] **Step 2: Open /orb in browser**

Navigate to `http://localhost:3000/orb`. Expected:
- Solid black background
- A particle cloud orb visible in center, occupying ~60-70% of canvas
- Four buttons at the bottom (idle selected/underlined by default)
- Particles have soft circular appearance (no hard pixel squares)
- Slight camera orbit visible after a few seconds
- 60 fps (check DevTools Performance tab if unsure)

If **no orb is visible**, open the browser console. Common issues:
- WebGL context error → check `renderer = new THREE.WebGLRenderer(...)` — may need fallback to `powerPreference: 'default'`
- Shader compile error → the error message includes the full GLSL; look for syntax issues in vertex/fragment shader
- Black screen with no errors → likely alpha/blending issue; verify `transparent: true` and `depthWrite: false`

- [ ] **Step 3: Verify each state reads distinctly**

Click through each button and hold for 5+ seconds:

| State           | Expected visual                                                                |
|-----------------|--------------------------------------------------------------------------------|
| idle            | Barely moving, slow gentle breath, monochrome white/gray. Dormant.             |
| conscious       | Visible swirling currents, periodic radial pulse every 2-3s, faint green tint on brighter particles. |
| subconscious    | Slower but larger drift, particles swell/contract, faint violet tint on brighter particles. |
| transitioning   | Particles scattered outward, chaotic, held expanded (when button held).        |

- [ ] **Step 4: Verify auto-burst transitions**

Click `idle` → wait → click `conscious`. Expected: particles briefly scatter outward (~0.7s burst), then settle into conscious behavior. Total visible transition ≈1.5s, smooth, never snaps. Repeat for idle→subconscious, conscious→subconscious, and reverse orders.

- [ ] **Step 5: Tuning pass (if needed)**

If any state doesn't match the design spec's qualitative targets, adjust the constants. Common knobs:

| Problem                                    | File to edit                              | Knob                                    |
|--------------------------------------------|-------------------------------------------|-----------------------------------------|
| Colors read too strong / too "green"/"purple" | `orb-scene.ts` (`createOrbMaterial`)    | `uColorConscious` / `uColorSubconscious` hex — move closer to white |
| Particles too large / too small            | `orb-scene.ts` (`createOrbMaterial`)      | `uSize` uniform initial value           |
| Too few / too many particles               | `orb-scene.ts` (`PARTICLE_COUNT`)         | 5000–10000 range                        |
| Turbulence too calm / too wild in state X  | `orb.vert.glsl.ts`                        | `turbAmp` coefficient for that state    |
| Orb too large / too small in frame         | `orb-scene.ts` (`createOrbScene`)         | `camera.position.z` (larger = smaller orb) |
| Edge too hard / too soft                   | `orb.vert.glsl.ts`                        | `smoothstep(0.20, 0.02, ...)` bounds   |
| Transition burst too short / too long      | `orb-scene.ts`                            | `BURST_DURATION_MS`                     |
| State lerp too snappy / too sluggish       | `orb-scene.ts`                            | `LERP_TAU`                              |

Apply changes, save, verify the dev-server HMR picks them up, re-check the affected state. Iterate until it feels right.

- [ ] **Step 6: Performance check**

In browser DevTools Performance tab, record 3 seconds of animation on each state. Expected: consistent 60 fps (16.7ms frame budget), no long tasks from the animation loop. If you see sub-60, reduce `PARTICLE_COUNT` toward 5000 or lower `uPixelRatio` cap from 2 to 1.5.

- [ ] **Step 7: Stop dev server**

- [ ] **Step 8: Commit any tuning changes**

```bash
cd k:/_dev/ai_orb && git add -A && git status
```

Inspect what changed. If only parameter tweaks in shader/scene files, commit:
```bash
cd k:/_dev/ai_orb && git commit -m "tune(orb): visual adjustments from QA pass"
```

If no changes needed, no commit — just note that visual verification passed.

---

## Completion checklist

When all tasks above are checked, the feature is complete:

- [ ] `three` and `@types/three` installed
- [ ] Shader files (noise, vert, frag) compile without errors
- [ ] `orb-scene.ts` builds geometry, material, and runs a loop
- [ ] `<AgentOrb state="..." />` mounts, unmounts cleanly, responds to prop changes
- [ ] `/orb` demo page renders all four states distinctly
- [ ] Auto-burst triggers on semantic state changes
- [ ] No TypeScript errors, no build errors, no runtime console errors
- [ ] Visual QA passed against spec's qualitative targets
