export interface StateMotion {
  orbitSpeed: number;   // rad/sec, Y-axis drift
  turbAmp: number;      // curl-noise displacement magnitude (world units)
  noiseFreq: number;    // spatial frequency of the curl-noise field
  noiseSpeed: number;   // how fast the noise field evolves through time
  breathFreq: number;   // radial breathing frequency in rad/sec (0 = constant, not sinusoidal)
  breathAmp: number;    // radial breathing amplitude as fraction of sphere radius
}

export interface OrbConfig {
  particleCount: number;
  pointSizeBase: number;     // base pixel size multiplier (uSize uniform)
  pointSizeScale: number;    // perspective scale (K in K/viewDist); raise for bigger particles
  alphaAttenuation: number;  // multiplied into final fragment alpha; lower = more translucent
  cameraDistance: number;    // camera orbit radius (world units)
  cameraOrbitSpeed: number;  // rad/sec, camera auto-rotation
  burstDurationMs: number;   // hold-time on state 3 during auto-transitions
  lerpTau: number;           // uState lerp time constant (seconds) — ~3× tau to fully settle
  colors: {
    base: number;            // hex — dominant particle color (dim particles)
    conscious: number;       // hex — tint for bright particles in conscious state
    subconscious: number;    // hex — tint for bright particles in subconscious state
  };
  states: {
    idle: StateMotion;
    conscious: StateMotion;
    subconscious: StateMotion;
    transitioning: StateMotion;
  };
}

export const ORB_CONFIG: OrbConfig = {
  particleCount: 8000,
  pointSizeBase: 1.0,
  pointSizeScale: 7.0,
  alphaAttenuation: 0.35,

  cameraDistance: 3.0,
  cameraOrbitSpeed: 0.05,

  burstDurationMs: 700,
  lerpTau: 0.45,

  colors: {
    base:         0xffffff,
    conscious:    0xb8d8c9,
    subconscious: 0xc8c4dd,
  },

  states: {
    idle:          { orbitSpeed: 0.02, turbAmp: 0.015, noiseFreq: 1.0, noiseSpeed: 0.3, breathFreq: 0.8, breathAmp: 0.03 },
    conscious:     { orbitSpeed: 0.15, turbAmp: 0.05,  noiseFreq: 1.8, noiseSpeed: 0.6, breathFreq: 2.5, breathAmp: 0.04 },
    subconscious:  { orbitSpeed: 0.06, turbAmp: 0.12,  noiseFreq: 0.6, noiseSpeed: 0.2, breathFreq: 0.5, breathAmp: 0.08 },
    transitioning: { orbitSpeed: 0.05, turbAmp: 0.06,  noiseFreq: 1.2, noiseSpeed: 0.25, breathFreq: 0,  breathAmp: 0.10 },
  },
};
