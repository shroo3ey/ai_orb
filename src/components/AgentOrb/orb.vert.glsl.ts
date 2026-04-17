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
uniform float uPointSizeScale;
uniform float uOrbRadius;
uniform float uCamDist;

// Packed state parameters: .x=idle, .y=conscious, .z=subconscious, .w=transitioning
uniform vec4 uOrbitSpeeds;
uniform vec4 uTurbAmps;
uniform vec4 uNoiseFreqs;
uniform vec4 uNoiseSpeeds;
uniform vec4 uBreathFreqs;
uniform vec4 uBreathAmps;

varying float vSeed;
varying float vDepth;
varying float vEdgeFade;

vec3 rotateY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
  float wIdle = clamp(1.0 - abs(uState - 0.0), 0.0, 1.0);
  float wCons = clamp(1.0 - abs(uState - 1.0), 0.0, 1.0);
  float wSubc = clamp(1.0 - abs(uState - 2.0), 0.0, 1.0);
  float wTran = clamp(1.0 - abs(uState - 3.0), 0.0, 1.0);
  vec4 w = vec4(wIdle, wCons, wSubc, wTran);

  float orbitSpeed = dot(uOrbitSpeeds, w);
  float turbAmp    = dot(uTurbAmps, w);
  float noiseFreq  = dot(uNoiseFreqs, w);
  float noiseSpeed = dot(uNoiseSpeeds, w);

  // Breathing: idle/cons/subc are sinusoidal; transitioning is a constant outward push.
  float breathIdle = sin(uTime * uBreathFreqs.x) * uBreathAmps.x;
  float breathCons = sin(uTime * uBreathFreqs.y) * uBreathAmps.y;
  float breathSubc = sin(uTime * uBreathFreqs.z) * uBreathAmps.z;
  float breathTran = uBreathAmps.w;
  float breath = breathIdle * wIdle + breathCons * wCons + breathSubc * wSubc + breathTran * wTran;

  vec3 p = position;

  p = rotateY(p, uTime * orbitSpeed + aPhase * 0.1);

  vec3 noisePos = p * noiseFreq + vec3(uTime * noiseSpeed);
  p += curl(noisePos) * turbAmp;

  p *= (1.0 + breath);

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float viewDist = -mvPosition.z;
  // vDepth: 1 at front of sphere (viewDist = camDist - radius), 0 at back (camDist + radius).
  float near = uCamDist - uOrbRadius;
  float span = max(2.0 * uOrbRadius, 0.001);
  vDepth = clamp(1.0 - (viewDist - near) / span, 0.0, 1.0);

  gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed * 0.8) * (uPointSizeScale / max(viewDist, 0.001));

  vEdgeFade = smoothstep(0.20, 0.02, abs(aRadialOffset));
  vSeed = aSeed;
}
`;
