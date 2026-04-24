export interface OrbConfig {
  particleCount: number;
  orbRadius: number;         // physical radius of the particle sphere (world units)
  radialJitter: number;      // max fractional radial deviation from perfect sphere
  particleSize: number;      // combined size multiplier (base × perspective scale)
  alphaAttenuation: number;  // multiplied into final fragment alpha; lower = more translucent
  cameraDistance: number;    // camera orbit radius (world units); MUST be > orbRadius
  cameraOrbitSpeed: number;  // rad/sec, camera auto-rotation
  attract: {
    freq: number;            // spatial frequency of the attractor density field
    speed: number;           // how fast attractor peaks drift through space
    maxStep: number;         // per-frame cap on attractor displacement (0–0.1)
  };
  colors: {
    base: number;            // hex — dominant particle color (dim particles)
    conscious: number;       // hex — tint for bright particles in conscious state
  };
}

export const ORB_CONFIG: OrbConfig = {
  particleCount: 12700,
  orbRadius: 0.15,
  radialJitter: 0,
  particleSize: 2.0,
  alphaAttenuation: 5,

  cameraDistance: 0.98,
  cameraOrbitSpeed: 0.3,

  attract: {
    freq: 8.7,
    speed: -0.26,
    maxStep: 0.02,
  },

  colors: {
    base:      0xffffff,
    conscious: 0xefa61e,
  },
};
