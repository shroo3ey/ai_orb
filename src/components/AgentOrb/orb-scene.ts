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
  setColorLerpTau: (tau: number) => void;
  setBreath: (freq: number, amp: number) => void;
  setAttract: (freq: number, speed: number, maxStep: number) => void;
  setCameraOrbitSpeed: (speed: number) => void;
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

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  let geometry = createOrbGeometry(ORB_CONFIG.particleCount, ORB_CONFIG.orbRadius, ORB_CONFIG.radialJitter);
  const material = createOrbMaterial(pixelRatio);
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const geometryKey = () => `${ORB_CONFIG.particleCount}|${ORB_CONFIG.orbRadius}|${ORB_CONFIG.radialJitter}`;
  let lastGeometryKey = geometryKey();

  let colorLerpTau = 0.9;
  const SMOOTH_LERP_TAU = 0.9;

  let targetColorBase = new THREE.Color(0xffffff);
  let targetColorConscious = new THREE.Color(0xffffff);

  let breathPhase = 0;
  let attractPhase = 0;
  let camOrbitAngle = 0;

  // Breath targets — set via setBreath(), lerped per-frame
  let targetBreathFreq = 0;
  let targetBreathAmp = 0;
  let smoothBreathFreq = 0;
  let smoothBreathAmp = 0;

  let targetAttractSpeed = -0.26;
  let targetAttractFreq = 8.7;
  let targetAttractMaxStep = 0.02;
  let smoothAttractSpeed = targetAttractSpeed;
  let smoothAttractFreq = targetAttractFreq;
  let targetCameraOrbitSpeed = 0.3;
  let smoothCameraOrbitSpeed = targetCameraOrbitSpeed;

  let lastFrame = performance.now();
  let frameId = 0;

  const setBreath = (freq: number, amp: number) => {
    targetBreathFreq = freq;
    targetBreathAmp = amp;
  };

  const updateConfig = () => {
    const nextGeometryKey = geometryKey();
    if (nextGeometryKey !== lastGeometryKey) {
      const nextGeometry = createOrbGeometry(ORB_CONFIG.particleCount, ORB_CONFIG.orbRadius, ORB_CONFIG.radialJitter);
      points.geometry = nextGeometry;
      geometry.dispose();
      geometry = nextGeometry;
      lastGeometryKey = nextGeometryKey;
    }

    material.uniforms.uParticleSize.value = ORB_CONFIG.particleSize;
    material.uniforms.uAlphaAttenuation.value = ORB_CONFIG.alphaAttenuation;
    material.uniforms.uOrbRadius.value = ORB_CONFIG.orbRadius;
    material.uniforms.uCamDist.value = ORB_CONFIG.cameraDistance;
  };

  updateConfig();

  const animate = () => {
    frameId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;

    // Smooth live-config scalars
    const smoothAlpha = 1 - Math.exp(-dt / SMOOTH_LERP_TAU);
    smoothAttractSpeed += (targetAttractSpeed - smoothAttractSpeed) * smoothAlpha;
    smoothAttractFreq += (targetAttractFreq - smoothAttractFreq) * smoothAlpha;
    smoothCameraOrbitSpeed += (targetCameraOrbitSpeed - smoothCameraOrbitSpeed) * smoothAlpha;
    smoothBreathFreq += (targetBreathFreq - smoothBreathFreq) * smoothAlpha;
    smoothBreathAmp += (targetBreathAmp - smoothBreathAmp) * smoothAlpha;

    breathPhase += dt * smoothBreathFreq;
    attractPhase += dt * smoothAttractSpeed;
    camOrbitAngle += dt * smoothCameraOrbitSpeed;

    // Color lerp
    const colorAlpha = 1 - Math.exp(-dt / colorLerpTau);
    (material.uniforms.uColorBase.value as THREE.Color).lerp(targetColorBase, colorAlpha);
    (material.uniforms.uColorConscious.value as THREE.Color).lerp(targetColorConscious, colorAlpha);

    material.uniforms.uBreathAmp.value = smoothBreathAmp;
    material.uniforms.uBreathPhase.value = breathPhase;
    material.uniforms.uAttractPhase.value = attractPhase;
    material.uniforms.uAttractFreq.value = smoothAttractFreq;
    material.uniforms.uAttractMaxStep.value = targetAttractMaxStep;

    camera.position.x = Math.sin(camOrbitAngle) * ORB_CONFIG.cameraDistance;
    camera.position.z = Math.cos(camOrbitAngle) * ORB_CONFIG.cameraDistance;
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

  const setColors = (base: number, conscious: number) => {
    targetColorBase.setHex(base);
    targetColorConscious.setHex(conscious);
  };

  const setColorLerpTau = (tau: number) => {
    colorLerpTau = Math.max(0.05, tau);
  };

  const setAttract = (freq: number, speed: number, maxStep: number) => {
    targetAttractFreq = freq;
    targetAttractSpeed = speed;
    targetAttractMaxStep = maxStep;
  };

  const setCameraOrbitSpeed = (speed: number) => {
    targetCameraOrbitSpeed = speed;
  };

  return { updateConfig, setColors, setColorLerpTau, setBreath, setAttract, setCameraOrbitSpeed, resize, dispose };
}
