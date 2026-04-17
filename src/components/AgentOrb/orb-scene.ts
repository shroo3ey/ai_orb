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

const STATE_TARGET: Record<OrbState, number> = {
  idle: 0,
  conscious: 1,
  subconscious: 2,
  transitioning: 3,
};

const BURST_DURATION_MS = 700;
const LERP_TAU = 0.45;
const PARTICLE_COUNT = 8000;

export interface OrbScene {
  setState: (state: OrbState) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createOrbScene(container: HTMLElement): OrbScene {
  const width = container.clientWidth;
  const height = container.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setClearColor(0x000000, 1);
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const geometry = createOrbGeometry(PARTICLE_COUNT);
  const material = createOrbMaterial(pixelRatio);
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let currentState: OrbState = 'idle';
  let currentTarget = 0;
  let stateUniform = 0;
  let burstEndTime = 0;
  let pendingSettleTarget: number | null = null;

  const startTime = performance.now();
  let lastFrame = startTime;
  let frameId = 0;

  const setState = (next: OrbState) => {
    if (next === currentState) return;
    const prev = currentState;
    currentState = next;

    if (next === 'transitioning') {
      currentTarget = 3;
      pendingSettleTarget = null;
      return;
    }

    if (prev !== 'transitioning') {
      currentTarget = 3;
      burstEndTime = performance.now() + BURST_DURATION_MS;
      pendingSettleTarget = STATE_TARGET[next];
    } else {
      currentTarget = STATE_TARGET[next];
      pendingSettleTarget = null;
    }
  };

  const animate = () => {
    frameId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    const elapsed = (now - startTime) / 1000;

    if (pendingSettleTarget !== null && now >= burstEndTime) {
      currentTarget = pendingSettleTarget;
      pendingSettleTarget = null;
    }

    stateUniform += (currentTarget - stateUniform) * (1 - Math.exp(-dt / LERP_TAU));

    material.uniforms.uTime.value = elapsed;
    material.uniforms.uState.value = stateUniform;

    const camAngle = elapsed * 0.05;
    camera.position.x = Math.sin(camAngle) * 3;
    camera.position.z = Math.cos(camAngle) * 3;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  };
  animate();

  const resize = (w: number, h: number) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  const dispose = () => {
    cancelAnimationFrame(frameId);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };

  return { setState, resize, dispose };
}
