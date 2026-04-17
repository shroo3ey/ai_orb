# Orb Pulse Animation — Design

## Goal

Add a one-shot "ping" pulse to `AgentOrb`: a button triggers an imperative call that briefly expands the orb's radius with a smooth bell-curve animation, then settles back. Runs on top of the existing breathing animation without interfering with state transitions.

## Architecture

### Shader layer

The vertex shader already applies a radial scale:

```glsl
p *= (1.0 + breath);
```

Add a `uPulse` uniform (single float, 0 at rest) and extend the scale:

```glsl
p *= (1.0 + breath + uPulse);
```

`uPulse` is additive on top of `breath`, so it composes cleanly with idle/conscious/subconscious breathing without fighting the state-blend math. No changes to attract, curl-noise, or rotation paths.

### Scene layer (`orb-scene.ts`)

Extend `OrbScene` with a `pulse()` method:

```ts
export interface OrbScene {
  setState: (state: OrbState) => void;
  pulse: () => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}
```

Track pulse state locally:

- `pulseStart: number | null` — timestamp in seconds (scene-relative `elapsed`) of current pulse, or `null` when idle.
- `pulse()` sets `pulseStart = elapsed`. Calling while one is in flight simply restarts it (overrides rather than queues).

In `animate()`, after computing `elapsed`:

```ts
let pulseVal = 0;
if (pulseStart !== null) {
  const t = (elapsed - pulseStart) / ORB_CONFIG.pulse.duration;
  if (t >= 1) {
    pulseStart = null;
  } else {
    // Bell curve: 0 → peak at t=0.5 → 0, with ease-out bias so it feels like a ping.
    // sin(π·t) is the bell; raising t to a power <1 biases the peak earlier.
    const eased = Math.sin(Math.PI * Math.pow(t, 0.7));
    pulseVal = eased * ORB_CONFIG.pulse.amplitude;
  }
}
material.uniforms.uPulse.value = pulseVal;
```

Ease-out bias (`Math.pow(t, 0.7)`) shifts the peak slightly earlier than the midpoint so the outward expansion feels snappy and the settle feels unhurried — more "ping" than "swell."

### Config layer (`config.ts`)

Add to `OrbConfig`:

```ts
pulse: {
  amplitude: number;   // extra radius as fraction of orb (e.g. 0.25 = +25%)
  duration: number;    // total animation time in seconds
};
```

Defaults:

```ts
pulse: {
  amplitude: 0.25,
  duration: 0.7,
},
```

### React layer (`AgentOrb.tsx`)

Convert to `forwardRef` and expose an imperative handle:

```ts
export interface AgentOrbHandle {
  pulse: () => void;
}

export const AgentOrb = forwardRef<AgentOrbHandle, AgentOrbProps>(...);
```

The handle exposes a single `pulse()` method that delegates to `sceneRef.current?.pulse()`. Use `useImperativeHandle` so the surface stays stable across renders.

### Demo page (`src/app/orb/page.tsx`)

Add an `AgentOrbHandle` ref, pass it to `<AgentOrb ref={...} />`, and add a "Pulse" button alongside the state buttons that calls `orbRef.current?.pulse()`.

## Data flow

```
Button click
  → orbRef.current.pulse()
  → scene.pulse()           (sets pulseStart = elapsed)
  → animate() frame         (reads pulseStart, writes uPulse.value)
  → vertex shader           (p *= 1.0 + breath + uPulse)
```

One-directional, no state in React for the pulse itself — the scene is the source of truth.

## Error handling

- `orbRef.current` may be null before the scene mounts. The `?.` chain handles it.
- `sceneRef.current` may be null between unmount and next mount. Already handled in existing code with `?.`.
- Rapid repeated presses simply restart the pulse — no queue, no reentrancy issues.

## Testing

Manual verification on the `/orb` demo page:

1. Click "Pulse" once in each state (`idle`, `conscious`, `subconscious`) — pulse should be visible and smooth in all three.
2. Click "Pulse" rapidly — each press restarts the animation from the start without flicker or accumulation.
3. Switch state during a pulse — state transition and pulse should coexist without visual artifacts.
4. Resize window during a pulse — pulse continues smoothly (timing is `elapsed`-based, not frame-count-based).

No automated tests — this is a visual animation feature on a WebGL canvas.

## Out of scope

- Queuing multiple pulses.
- Different pulse shapes per state.
- Color flash during pulse.
- Pulse on state change (could be a future addition; for now, pulses are only user-triggered).
