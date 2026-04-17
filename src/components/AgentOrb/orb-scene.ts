import * as THREE from 'three';
import { VERTEX_SHADER } from './orb.vert.glsl';
import { FRAGMENT_SHADER } from './orb.frag.glsl';

export type OrbState = 'idle' | 'conscious' | 'subconscious' | 'transitioning';

export function createOrbGeometry(count: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const radialOffsets = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);

    const offsetRand = Math.random();
    const offset = Math.pow(offsetRand, 2) * 0.2 - 0.15;
    const r = 1.0 + offset;

    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    seeds[i] = Math.random();
    radialOffsets[i] = offset;
    phases[i] = Math.random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aRadialOffset', new THREE.BufferAttribute(radialOffsets, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  return geometry;
}

export function createOrbMaterial(pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uState: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uSize: { value: 2.0 },
      uColorBase: { value: new THREE.Color(0xffffff) },
      uColorConscious: { value: new THREE.Color(0xb8d8c9) },
      uColorSubconscious: { value: new THREE.Color(0xc8c4dd) },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    transparent: true,
  });
}
