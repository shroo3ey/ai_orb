export interface OrbConfig {
  particleCount: number;
  orbRadius: number;         // physical radius of the particle sphere (world units)
  radialJitter: number;      // max fractional radial deviation from perfect sphere
  particleSize: number;      // combined size multiplier (base × perspective scale)
  alphaAttenuation: number;  // multiplied into final fragment alpha; lower = more translucent
  cameraDistance: number;    // camera orbit radius (world units); MUST be > orbRadius
  lerp: number;              // exponential smoothing time constant (seconds)
}

export const ORB_CONFIG: OrbConfig = {
  particleCount: 12700,
  orbRadius: 0.15,
  radialJitter: 0,
  particleSize: 2.0,
  alphaAttenuation: 5,
  cameraDistance: 0.98,
  lerp: 0.9,
};
