import * as THREE from 'three';
import { VERTEX_SHADER } from './orb.vert.glsl';
import { FRAGMENT_SHADER } from './orb.frag.glsl';
import { ORB_CONFIG } from './config';

export function createOrbGeometry(count: number, radius: number, radialJitter: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const radialOffsets = new Float32Array(count);

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
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aRadialOffset', new THREE.BufferAttribute(radialOffsets, 1));

  return geometry;
}

export function createOrbMaterial(pixelRatio: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uParticleSize: { value: ORB_CONFIG.particleSize },
      uAlphaAttenuation: { value: ORB_CONFIG.alphaAttenuation },
      uOrbRadius: { value: ORB_CONFIG.orbRadius },
      uCamDist: { value: ORB_CONFIG.cameraDistance },
      uColorBase: { value: new THREE.Color(0xffffff) },
      uColorConscious: { value: new THREE.Color(0xffffff) },
      uBreathAmp: { value: 0 },
      uBreathPhase: { value: 0 },
      uAttractPhase: { value: 0 },
      uAttractFreq: { value: 8.7 },
      uAttractMaxStep: { value: 0.02 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    transparent: true,
  });
}

export interface OrbScene {
  updateConfig: () => void;
  setColors: (base: number, conscious: number) => void;
  setBreath: (freq: number, amp: number) => void;
  setAttract: (freq: number, speed: number, maxStep: number) => void;
  setCameraOrbitSpeed: (speed: number) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createOrbScene(container: HTMLElement): OrbScene {
  const { clientWidth: width, clientHeight: height } = container;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, ORB_CONFIG.cameraDistance);
  camera.lookAt(0, 0, 0);

  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  let geometry = createOrbGeometry(ORB_CONFIG.particleCount, ORB_CONFIG.orbRadius, ORB_CONFIG.radialJitter);
  const material = createOrbMaterial(pixelRatio);
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const geometryKey = () => `${ORB_CONFIG.particleCount}|${ORB_CONFIG.orbRadius}|${ORB_CONFIG.radialJitter}`;
  let lastGeometryKey = geometryKey();

  const targetColorBase = new THREE.Color(0xffffff);
  const targetColorConscious = new THREE.Color(0xffffff);

  let breathPhase = 0;
  let attractPhase = 0;
  let camOrbitAngle = 0;

  const target = { breathFreq: 0, breathAmp: 0, attractSpeed: -0.26, attractFreq: 8.7, attractMaxStep: 0.02, cameraOrbitSpeed: 0.3 };
  const smooth = { ...target };

  let lastFrame = performance.now();
  let frameId = 0;

  const { uniforms } = material;

  const updateConfig = () => {
    const key = geometryKey();
    if (key !== lastGeometryKey) {
      const next = createOrbGeometry(ORB_CONFIG.particleCount, ORB_CONFIG.orbRadius, ORB_CONFIG.radialJitter);
      points.geometry = next;
      geometry.dispose();
      geometry = next;
      lastGeometryKey = key;
    }

    uniforms.uParticleSize.value = ORB_CONFIG.particleSize;
    uniforms.uAlphaAttenuation.value = ORB_CONFIG.alphaAttenuation;
    uniforms.uOrbRadius.value = ORB_CONFIG.orbRadius;
    uniforms.uCamDist.value = ORB_CONFIG.cameraDistance;
  };

  updateConfig();

  const animate = () => {
    frameId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    const alpha = 1 - Math.exp(-dt / ORB_CONFIG.lerp);
    for (const k of Object.keys(smooth) as (keyof typeof smooth)[]) {
      smooth[k] += (target[k] - smooth[k]) * alpha;
    }

    breathPhase += dt * smooth.breathFreq;
    attractPhase += dt * smooth.attractSpeed;
    camOrbitAngle += dt * smooth.cameraOrbitSpeed;

    (uniforms.uColorBase.value as THREE.Color).lerp(targetColorBase, alpha);
    (uniforms.uColorConscious.value as THREE.Color).lerp(targetColorConscious, alpha);

    uniforms.uBreathAmp.value = smooth.breathAmp;
    uniforms.uBreathPhase.value = breathPhase;
    uniforms.uAttractPhase.value = attractPhase;
    uniforms.uAttractFreq.value = smooth.attractFreq;
    uniforms.uAttractMaxStep.value = smooth.attractMaxStep;

    camera.position.x = Math.sin(camOrbitAngle) * ORB_CONFIG.cameraDistance;
    camera.position.z = Math.cos(camOrbitAngle) * ORB_CONFIG.cameraDistance;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  };
  animate();

  return {
    updateConfig,
    setColors: (base: number, conscious: number) => {
      targetColorBase.setHex(base);
      targetColorConscious.setHex(conscious);
    },
    setBreath: (freq: number, amp: number) => {
      target.breathFreq = freq;
      target.breathAmp = amp;
    },
    setAttract: (freq: number, speed: number, maxStep: number) => {
      target.attractFreq = freq;
      target.attractSpeed = speed;
      target.attractMaxStep = maxStep;
    },
    setCameraOrbitSpeed: (speed: number) => { target.cameraOrbitSpeed = speed; },
    resize: (w: number, h: number) => {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    },
    dispose: () => {
      cancelAnimationFrame(frameId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.parentNode?.removeChild(renderer.domElement);
    },
  };
}
