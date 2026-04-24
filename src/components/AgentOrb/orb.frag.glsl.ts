export const FRAGMENT_SHADER = /* glsl */ `
uniform float uAlphaAttenuation;
uniform vec3 uColorBase;
uniform vec3 uColorConscious;

varying float vSeed;
varying float vDepth;
varying float vEdgeFade;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float d = length(coord);
  float alpha = smoothstep(0.5, 0.15, d);

  float brightness = vDepth * (0.5 + vSeed * 0.5);

  vec3 tint = mix(uColorBase, uColorConscious, brightness);

  gl_FragColor = vec4(tint, alpha * vEdgeFade * brightness * uAlphaAttenuation);
}
`;
