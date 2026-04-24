import { NOISE_GLSL } from './noise.glsl';

export const VERTEX_SHADER = /* glsl */ `
${NOISE_GLSL}

attribute float aSeed;
attribute float aRadialOffset;
attribute float aPhase; // [0,1] per-particle random used as angular-speed multiplier
attribute float aCore;

uniform float uTime;
uniform float uState;
uniform float uPixelRatio;
uniform float uSize;
uniform float uPointSizeScale;
uniform float uOrbRadius;
uniform float uCamDist;

// Time-integrated phases (accumulated in JS using dt × blended-speed, so speed changes
// don't retroactively scale by elapsed time).
uniform float uOrbitAngle;
uniform float uNoisePhase;
uniform float uBreathPhase;
uniform float uAttractPhase;

// Attractor (clumping) field parameters — global, not per-state.
uniform float uAttractFreq;
uniform float uAttractStrength;
uniform float uAttractExponent;
uniform float uAttractDeadzone;
uniform float uAttractMaxStep;
uniform float uCenterPull;
uniform float uCenterPullFalloff;

// Per-particle rotation-axis wobble amount; 0 = all share Y axis, 1 = fully noise-driven.
uniform float uAxisVariance;

// Packed state parameters: .x=idle, .y=conscious
uniform vec2 uTurbAmps;
uniform vec2 uNoiseFreqs;
uniform vec2 uBreathAmps;

varying float vSeed;
varying float vDepth;
varying float vEdgeFade;
varying float vCore;

// Rodrigues rotation around an arbitrary unit axis through the origin.
// Preserves distance from origin, so sphere membership is retained.
vec3 rotateAxis(vec3 p, vec3 axis, float a) {
  float c = cos(a);
  float s = sin(a);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

void main() {
  float wIdle = clamp(1.0 - abs(uState - 0.0), 0.0, 1.0);
  float wCons = clamp(1.0 - abs(uState - 1.0), 0.0, 1.0);
  vec2 w = vec2(wIdle, wCons);

  float turbAmp    = dot(uTurbAmps, w);
  float noiseFreq  = dot(uNoiseFreqs, w);
  float breathAmp  = dot(uBreathAmps, w);

  float breath = sin(uBreathPhase) * breathAmp;

  vec3 p = position;

  // Per-particle speed spread (0.4x..1.6x) so particles overtake each other like a swarm.
  float swarmSpeed = 20.4 + aPhase * 1.2;

  // Per-particle rotation axis = shared base axis + clamped noise wobble.
  // uAxisVariance controls how much each particle deviates from the shared direction.
  vec3 axisSeed = position * 3.0;
  vec3 axisNoise = vec3(
    snoise(axisSeed),
    snoise(axisSeed + vec3(17.3,  0.0,  0.0)),
    snoise(axisSeed + vec3( 0.0, 31.1,  0.0))
  );
  vec3 axis = normalize(vec3(0.0, 1.0, 0.0) + axisNoise * uAxisVariance);

  p = rotateAxis(p, axis, uOrbitAngle * swarmSpeed);

  vec3 noisePos = p * noiseFreq + vec3(uNoisePhase);
  p += curl(noisePos) * turbAmp;

  // Attractor pull: displace toward gradient of a slowly-evolving scalar noise field.
  // Neighbors near a peak get pulled the same direction → clumps form.
  // Peaks drift over time (uAttractPhase) → clumps break and reform elsewhere.
  vec3 attractPos = p * uAttractFreq + vec3(uAttractPhase);
  vec3 attractForce = gradNoise(attractPos);
  float attractMag = length(attractForce);
  if (attractMag > 0.00001) {
    float curvedMag = pow(attractMag, max(uAttractExponent, 0.00001));
    attractForce *= curvedMag / attractMag;
  }

  float deadzoneStart = max(uAttractDeadzone, 0.0);
  float deadzoneEnd = deadzoneStart + 0.25;
  float deadzoneWeight = smoothstep(deadzoneStart, deadzoneEnd, attractMag);
  vec3 attractStep = attractForce * (uAttractStrength * deadzoneWeight);

  float maxStep = max(uAttractMaxStep, 0.00001);
  float attractStepLen = length(attractStep);
  if (attractStepLen > maxStep) {
    attractStep *= maxStep / attractStepLen;
  }
  p += attractStep;

  if (uCenterPull > 0.0) {
    float radial = length(p) / max(uOrbRadius, 0.00001);
    float radialWeight = pow(max(radial, 0.0), max(uCenterPullFalloff, 0.00001));
    vec3 toCenter = -normalize(p);
    p += toCenter * (uCenterPull * radialWeight);
  }

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
  vCore = aCore;
}
`;
