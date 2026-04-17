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
  float wIdle = clamp(1.0 - abs(uState - 0.0), 0.0, 1.0);
  float wCons = clamp(1.0 - abs(uState - 1.0), 0.0, 1.0);
  float wSubc = clamp(1.0 - abs(uState - 2.0), 0.0, 1.0);
  float wTran = clamp(1.0 - abs(uState - 3.0), 0.0, 1.0);

  float orbitSpeed = 0.02 * wIdle + 0.15 * wCons + 0.06 * wSubc + 0.10 * wTran;
  float turbAmp    = 0.015 * wIdle + 0.05 * wCons + 0.12 * wSubc + 0.20 * wTran;
  float noiseFreq  = 1.0 * wIdle + 1.8 * wCons + 0.6 * wSubc + 2.5 * wTran;
  float noiseSpeed = 0.3 * wIdle + 0.6 * wCons + 0.2 * wSubc + 0.8 * wTran;

  float breathIdle = sin(uTime * 0.8) * 0.03;
  float breathCons = sin(uTime * 2.5) * 0.04;
  float breathSubc = sin(uTime * 0.5) * 0.08;
  float breathTran = 0.15;
  float breath = breathIdle * wIdle + breathCons * wCons + breathSubc * wSubc + breathTran * wTran;

  vec3 p = position;

  p = rotateY(p, uTime * orbitSpeed + aPhase * 0.1);

  vec3 noisePos = p * noiseFreq + vec3(uTime * noiseSpeed);
  p += curl(noisePos) * turbAmp;

  p *= (1.0 + breath);

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float viewDist = -mvPosition.z;
  vDepth = clamp(1.0 - (viewDist - 2.0) / 2.0, 0.0, 1.0);

  gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed * 0.8) * (300.0 / max(viewDist, 0.001));

  vEdgeFade = smoothstep(0.20, 0.02, abs(aRadialOffset));
  vSeed = aSeed;
}
`;
