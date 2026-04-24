import { NOISE_GLSL } from './noise.glsl';

export const VERTEX_SHADER = /* glsl */ `
${NOISE_GLSL}

attribute float aSeed;
attribute float aRadialOffset;

uniform float uPixelRatio;
uniform float uParticleSize;
uniform float uOrbRadius;
uniform float uCamDist;

uniform float uBreathAmp;
uniform float uBreathPhase;
uniform float uAttractPhase;

uniform float uAttractFreq;
uniform float uAttractMaxStep;

varying float vSeed;
varying float vDepth;
varying float vEdgeFade;

void main() {
  vec3 p = position;

  // Attractor: displace toward gradient of a drifting noise field → clumps form and dissolve.
  vec3 attractPos = p * uAttractFreq + vec3(uAttractPhase);
  vec3 attractStep = gradNoise(attractPos);
  float stepLen = length(attractStep);
  if (stepLen > uAttractMaxStep) {
    attractStep *= uAttractMaxStep / stepLen;
  }
  p += attractStep;

  // Radial breathing
  p *= (1.0 + sin(uBreathPhase) * uBreathAmp);

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float viewDist = -mvPosition.z;
  float near = uCamDist - uOrbRadius;
  float span = max(2.0 * uOrbRadius, 0.001);
  vDepth = clamp(1.0 - (viewDist - near) / span, 0.0, 1.0);

  gl_PointSize = uParticleSize * uPixelRatio * (0.6 + aSeed * 0.8) / max(viewDist, 0.001);

  vEdgeFade = smoothstep(0.20, 0.02, abs(aRadialOffset));
  vSeed = aSeed;
}
`;
