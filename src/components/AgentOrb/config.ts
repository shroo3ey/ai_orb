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
  orbRadius: number;         // physical radius of the particle sphere (world units)
  radialJitter: number;      // max fractional radial deviation from perfect sphere (e.g. 0.02 = +/-2%)
  pointSizeBase: number;     // base pixel size multiplier (uSize uniform)
  pointSizeScale: number;    // perspective scale (K in K/viewDist); raise for bigger particles
  alphaAttenuation: number;  // multiplied into final fragment alpha; lower = more translucent
  cameraDistance: number;    // camera orbit radius (world units); MUST be > orbRadius
  cameraOrbitSpeed: number;  // rad/sec, camera auto-rotation
  lerpTau: number;           // uState lerp time constant (seconds) — ~3× tau to fully settle
  attract: {
    freq: number;            // spatial frequency of the attractor density field
    speed: number;           // how fast attractor peaks drift through space (noise phase advance rate)
    strength: number;        // displacement magnitude (world units per frame)
  };
  axisVariance: number;      // per-particle rotation-axis wobble; 0 = all particles share Y axis, 1 = fully random directions
  pulse: {
    amplitude: number;       // peak extra radius as fraction of orb (e.g. 0.25 = +25%)
    duration: number;        // total pulse duration in seconds
  };
  colors: {
    base: number;            // hex — dominant particle color (dim particles)
    conscious: number;       // hex — tint for bright particles in conscious state
    subconscious: number;    // hex — tint for bright particles in subconscious state
  };
  states: {
    idle: StateMotion;
    conscious: StateMotion;
    subconscious: StateMotion;
  };
}

export const ORB_CONFIG: OrbConfig = {
  particleCount: 8000,
  orbRadius: 0.2,
  radialJitter: 0.02,
  pointSizeBase: 1.0,
  pointSizeScale: 3.0,
  alphaAttenuation: 1,

  cameraDistance: 1.0,
  cameraOrbitSpeed: 0.5,

  lerpTau: 0.05,

  attract: {
    freq: 10.0,
    speed: 0.15,
    strength: 0.01,
  },

  axisVariance: 0.05,

  pulse: {
    amplitude: 0.25,
    duration: 0.7,
  },

  colors: {
    base:         0xffffff,
    conscious:    0xefa61e,
    subconscious: 0xc8c4dd,
  },

  states: {
    idle:          { orbitSpeed: 0.0, turbAmp: 0.0, noiseFreq: 0.0, noiseSpeed: 0.0, breathFreq: 3, breathAmp: 0.1 },
    conscious:     { orbitSpeed: 0.05, turbAmp: 0.0,  noiseFreq: 0.0, noiseSpeed: 0.0, breathFreq: 0.0, breathAmp: 0.1 },
    subconscious:  { orbitSpeed: 0.1, turbAmp: 0.0,  noiseFreq: 0.0, noiseSpeed: 0.0, breathFreq: 0.0, breathAmp: 0.00 },
  },
};
