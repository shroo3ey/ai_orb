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

export interface OrbLiveConfig {
  attractSpeed: number;
  attractFreq: number;
  attractMaxStep: number;
  cameraOrbitSpeed: number;
  breathAmp: number;
  breathFreq: number;
  baseColor: number;
  consciousColor: number;
}

export const PRESETS: Record<string, OrbLiveConfig> = {
  idle: {
    attractSpeed: -0.16,
    attractFreq: 14,
    attractMaxStep: 0.01,
    cameraOrbitSpeed: 0.1,
    breathAmp: 0,
    breathFreq: 0,
    baseColor: 0xffffff,
    consciousColor: 0x111111,
  },
  conscious: {
    attractSpeed: -0.45,
    attractFreq: 8.7,
    attractMaxStep: 0.02,
    cameraOrbitSpeed: 0.4,
    breathAmp: 0.1,
    breathFreq: 2,
    baseColor: 0xefa61e,
    consciousColor: 0xffe9b2,
  },
  tool: {
    attractSpeed: -0.6,
    attractFreq: 11,
    attractMaxStep: 0.02,
    cameraOrbitSpeed: 0.7,
    breathAmp: 0.13,
    breathFreq: 3,
    baseColor: 0xefa61e,
    consciousColor: 0xff6b1a,
  },
  subconscious: {
    attractSpeed: -0.15,
    attractFreq: 8.7,
    attractMaxStep: 0.02,
    cameraOrbitSpeed: 0.15,
    breathAmp: 0.04,
    breathFreq: 0.5,
    baseColor: 0x7b8ef7,
    consciousColor: 0x7b8ef7,
  },
};
