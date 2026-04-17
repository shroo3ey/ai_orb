import * as THREE from 'three';
import { VERTEX_SHADER } from './orb.vert.glsl';
import { FRAGMENT_SHADER } from './orb.frag.glsl';
import { ORB_CONFIG, type StateMotion } from './config';

export type OrbState = 'idle' | 'conscious' | 'subconscious';

export function createOrbGeometry(count: number, radius: number, radialJitter: number): THREE.BufferGeometry {
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

    const offset = (Math.random() * 2 - 1) * radialJitter;
    const r = radius * (1.0 + offset);

    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    seeds[i] = Math.random();
    radialOffsets[i] = offset;
    phases[i] = Math.random();
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aRadialOffset', new THREE.BufferAttribute(radialOffsets, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  return geometry;
}

function stateVec3(pick: (s: StateMotion) => number): THREE.Vector3 {
  const s = ORB_CONFIG.states;
  return new THREE.Vector3(pick(s.idle), pick(s.conscious), pick(s.subconscious));
}

export function createOrbMaterial(pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uState: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uSize: { value: ORB_CONFIG.pointSizeBase },
      uPointSizeScale: { value: ORB_CONFIG.pointSizeScale },
      uAlphaAttenuation: { value: ORB_CONFIG.alphaAttenuation },
      uOrbRadius: { value: ORB_CONFIG.orbRadius },
      uCamDist: { value: ORB_CONFIG.cameraDistance },
      uColorBase: { value: new THREE.Color(ORB_CONFIG.colors.base) },
      uColorConscious: { value: new THREE.Color(ORB_CONFIG.colors.conscious) },
      uColorSubconscious: { value: new THREE.Color(ORB_CONFIG.colors.subconscious) },
      uOrbitAngle: { value: 0 },
      uNoisePhase: { value: 0 },
      uBreathPhase: { value: 0 },
      uAttractPhase: { value: 0 },
      uAttractFreq: { value: ORB_CONFIG.attract.freq },
      uAttractStrength: { value: ORB_CONFIG.attract.strength },
      uAxisVariance: { value: ORB_CONFIG.axisVariance },
      uTurbAmps: { value: stateVec3((s) => s.turbAmp) },
      uNoiseFreqs: { value: stateVec3((s) => s.noiseFreq) },
      uBreathAmps: { value: stateVec3((s) => s.breathAmp) },
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
};

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
  camera.position.set(0, 0, ORB_CONFIG.cameraDistance);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setClearColor(0x000000, 1);
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const geometry = createOrbGeometry(ORB_CONFIG.particleCount, ORB_CONFIG.orbRadius, ORB_CONFIG.radialJitter);
  const material = createOrbMaterial(pixelRatio);
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let currentState: OrbState = 'idle';
  let currentTarget = 0;
  let stateUniform = 0;
  let orbitAngle = 0;
  let noisePhase = 0;
  let breathPhase = 0;
  let attractPhase = 0;

  const startTime = performance.now();
  let lastFrame = startTime;
  let frameId = 0;

  const setState = (next: OrbState) => {
    if (next === currentState) return;
    currentState = next;
    currentTarget = STATE_TARGET[next];
  };

  const animate = () => {
    frameId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    const elapsed = (now - startTime) / 1000;

    stateUniform += (currentTarget - stateUniform) * (1 - Math.exp(-dt / ORB_CONFIG.lerpTau));

    const wIdle = Math.max(0, Math.min(1, 1 - Math.abs(stateUniform - 0)));
    const wCons = Math.max(0, Math.min(1, 1 - Math.abs(stateUniform - 1)));
    const wSubc = Math.max(0, Math.min(1, 1 - Math.abs(stateUniform - 2)));
    const s = ORB_CONFIG.states;
    const orbitSpeed  = s.idle.orbitSpeed  * wIdle + s.conscious.orbitSpeed  * wCons + s.subconscious.orbitSpeed  * wSubc;
    const noiseSpeed  = s.idle.noiseSpeed  * wIdle + s.conscious.noiseSpeed  * wCons + s.subconscious.noiseSpeed  * wSubc;
    const breathFreq  = s.idle.breathFreq  * wIdle + s.conscious.breathFreq  * wCons + s.subconscious.breathFreq  * wSubc;
    orbitAngle   += dt * orbitSpeed;
    noisePhase   += dt * noiseSpeed;
    breathPhase  += dt * breathFreq;
    attractPhase += dt * ORB_CONFIG.attract.speed;

    material.uniforms.uTime.value = elapsed;
    material.uniforms.uState.value = stateUniform;
    material.uniforms.uOrbitAngle.value = orbitAngle;
    material.uniforms.uNoisePhase.value = noisePhase;
    material.uniforms.uBreathPhase.value = breathPhase;
    material.uniforms.uAttractPhase.value = attractPhase;

    const camAngle = elapsed * ORB_CONFIG.cameraOrbitSpeed;
    camera.position.x = Math.sin(camAngle) * ORB_CONFIG.cameraDistance;
    camera.position.z = Math.cos(camAngle) * ORB_CONFIG.cameraDistance;
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
