export const FRAGMENT_SHADER = /* glsl */ `
uniform float uState;
uniform float uAlphaAttenuation;
uniform vec3 uColorBase;
uniform vec3 uColorConscious;
uniform vec3 uColorSubconscious;

varying float vSeed;
varying float vDepth;
varying float vEdgeFade;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float d = length(coord);
  float alpha = smoothstep(0.5, 0.15, d);

  float brightness = vDepth * (0.5 + vSeed * 0.5);

  float wIdle = clamp(1.0 - abs(uState - 0.0), 0.0, 1.0);
  float wCons = clamp(1.0 - abs(uState - 1.0), 0.0, 1.0);
  float wSubc = clamp(1.0 - abs(uState - 2.0), 0.0, 1.0);

  vec3 tint = uColorBase * wIdle
            + mix(uColorBase, uColorConscious, brightness) * wCons
            + mix(uColorBase, uColorSubconscious, brightness) * wSubc;

  gl_FragColor = vec4(tint, alpha * vEdgeFade * brightness * uAlphaAttenuation);
}
`;
