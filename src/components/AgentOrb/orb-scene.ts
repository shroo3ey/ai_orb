import * as THREE from 'three';
import { VERTEX_SHADER } from './orb.vert.glsl';
import { FRAGMENT_SHADER } from './orb.frag.glsl';
import { ORB_CONFIG, type StateMotion } from './config';

export type OrbState = 'idle' | 'conscious';

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

function stateVec2(pick: (s: StateMotion) => number): THREE.Vector2 {
  const s = ORB_CONFIG.states;
  return new THREE.Vector2(pick(s.idle), pick(s.conscious));
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
      uOrbitAngle: { value: 0 },
      uNoisePhase: { value: 0 },
      uBreathPhase: { value: 0 },
      uAttractPhase: { value: 0 },
      uAttractFreq: { value: ORB_CONFIG.attract.freq },
      uAttractStrength: { value: ORB_CONFIG.attract.strength },
      uAttractExponent: { value: ORB_CONFIG.attract.exponent },
      uAttractDeadzone: { value: ORB_CONFIG.attract.deadzone },
      uAttractMaxStep: { value: ORB_CONFIG.attract.maxStep },
      uCenterPull: { value: ORB_CONFIG.attract.centerPull },
      uCenterPullFalloff: { value: ORB_CONFIG.attract.centerFalloff },
      uAxisVariance: { value: ORB_CONFIG.axisVariance },
      uTurbAmps: { value: stateVec2((s) => s.turbAmp) },
      uNoiseFreqs: { value: stateVec2((s) => s.noiseFreq) },
      uBreathAmps: { value: stateVec2((s) => s.breathAmp) },
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
};

export interface OrbScene {
  setState: (state: OrbState) => void;
  updateConfig: () => void;
  setColors: (base: number, conscious: number) => void;
  setColorLerpTau: (tau: number) => void;
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

  // Color lerp tau is live-tunable: default is slow, state-orb stretches it further
  // for subconscious so the indigo gradually emerges.
  let colorLerpTau = 0.9;
  // Smooth live-tuned scalars so tool/LLM state changes don't snap orb size or motion.
  const SMOOTH_LERP_TAU = 0.9;

  let targetColorBase = new THREE.Color(ORB_CONFIG.colors.base);
  let targetColorConscious = new THREE.Color(ORB_CONFIG.colors.conscious);

  let currentState: OrbState = 'idle';
  let currentTarget = 0;
  let stateUniform = 0;
  let orbitAngle = 0;
  let noisePhase = 0;
  let breathPhase = 0;
  let attractPhase = 0;
  let camOrbitAngle = 0;

  // ORB_CONFIG holds targets; these lerp toward them per-frame and feed uniforms.
  let smoothAttractStrength = ORB_CONFIG.attract.strength;
  let smoothAttractSpeed = ORB_CONFIG.attract.speed;
  let smoothAttractFreq = ORB_CONFIG.attract.freq;
  let smoothCameraOrbitSpeed = ORB_CONFIG.cameraOrbitSpeed;
  let smoothConsciousBreathAmp = ORB_CONFIG.states.conscious.breathAmp;
  let smoothConsciousBreathFreq = ORB_CONFIG.states.conscious.breathFreq;
  let smoothConsciousOrbitSpeed = ORB_CONFIG.states.conscious.orbitSpeed;

  const startTime = performance.now();
  let lastFrame = startTime;
  let frameId = 0;

  const setState = (next: OrbState) => {
    if (next === currentState) return;
    currentState = next;
    currentTarget = STATE_TARGET[next];
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

    material.uniforms.uSize.value = ORB_CONFIG.pointSizeBase;
    material.uniforms.uPointSizeScale.value = ORB_CONFIG.pointSizeScale;
    material.uniforms.uAlphaAttenuation.value = ORB_CONFIG.alphaAttenuation;
    material.uniforms.uOrbRadius.value = ORB_CONFIG.orbRadius;
    material.uniforms.uCamDist.value = ORB_CONFIG.cameraDistance;

    // uAttractFreq/Strength and uBreathAmps.y are driven per-frame in animate().
    material.uniforms.uAttractExponent.value = ORB_CONFIG.attract.exponent;
    material.uniforms.uAttractDeadzone.value = ORB_CONFIG.attract.deadzone;
    material.uniforms.uAttractMaxStep.value = ORB_CONFIG.attract.maxStep;
    material.uniforms.uCenterPull.value = ORB_CONFIG.attract.centerPull;
    material.uniforms.uCenterPullFalloff.value = ORB_CONFIG.attract.centerFalloff;

    material.uniforms.uAxisVariance.value = ORB_CONFIG.axisVariance;
    material.uniforms.uTurbAmps.value.set(ORB_CONFIG.states.idle.turbAmp, ORB_CONFIG.states.conscious.turbAmp);
    material.uniforms.uNoiseFreqs.value.set(ORB_CONFIG.states.idle.noiseFreq, ORB_CONFIG.states.conscious.noiseFreq);
  };

  updateConfig();

  const animate = () => {
    frameId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    const elapsed = (now - startTime) / 1000;

    stateUniform += (currentTarget - stateUniform) * (1 - Math.exp(-dt / ORB_CONFIG.lerpTau));

    const smoothAlpha = 1 - Math.exp(-dt / SMOOTH_LERP_TAU);
    smoothAttractStrength += (ORB_CONFIG.attract.strength - smoothAttractStrength) * smoothAlpha;
    smoothAttractSpeed += (ORB_CONFIG.attract.speed - smoothAttractSpeed) * smoothAlpha;
    smoothAttractFreq += (ORB_CONFIG.attract.freq - smoothAttractFreq) * smoothAlpha;
    smoothCameraOrbitSpeed += (ORB_CONFIG.cameraOrbitSpeed - smoothCameraOrbitSpeed) * smoothAlpha;
    smoothConsciousBreathAmp += (ORB_CONFIG.states.conscious.breathAmp - smoothConsciousBreathAmp) * smoothAlpha;
    smoothConsciousBreathFreq += (ORB_CONFIG.states.conscious.breathFreq - smoothConsciousBreathFreq) * smoothAlpha;
    smoothConsciousOrbitSpeed += (ORB_CONFIG.states.conscious.orbitSpeed - smoothConsciousOrbitSpeed) * smoothAlpha;

    const wIdle = Math.max(0, Math.min(1, 1 - Math.abs(stateUniform - 0)));
    const wCons = Math.max(0, Math.min(1, 1 - Math.abs(stateUniform - 1)));
    const s = ORB_CONFIG.states;
    const orbitSpeed = s.idle.orbitSpeed * wIdle + smoothConsciousOrbitSpeed * wCons;
    const noiseSpeed = s.idle.noiseSpeed * wIdle + s.conscious.noiseSpeed * wCons;
    const breathFreq = s.idle.breathFreq * wIdle + smoothConsciousBreathFreq * wCons;
    orbitAngle   += dt * orbitSpeed;
    noisePhase   += dt * noiseSpeed;
    breathPhase  += dt * breathFreq;
    attractPhase += dt * smoothAttractSpeed;
    camOrbitAngle += dt * smoothCameraOrbitSpeed;

    const colorAlpha = 1 - Math.exp(-dt / colorLerpTau);
    (material.uniforms.uColorBase.value as THREE.Color).lerp(targetColorBase, colorAlpha);
    (material.uniforms.uColorConscious.value as THREE.Color).lerp(targetColorConscious, colorAlpha);

    material.uniforms.uTime.value = elapsed;
    material.uniforms.uState.value = stateUniform;
    material.uniforms.uOrbitAngle.value = orbitAngle;
    material.uniforms.uNoisePhase.value = noisePhase;
    material.uniforms.uBreathPhase.value = breathPhase;
    material.uniforms.uAttractPhase.value = attractPhase;
    material.uniforms.uAttractStrength.value = smoothAttractStrength;
    material.uniforms.uAttractFreq.value = smoothAttractFreq;
    material.uniforms.uBreathAmps.value.set(s.idle.breathAmp, smoothConsciousBreathAmp);

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

  return { setState, updateConfig, setColors, setColorLerpTau, resize, dispose };
}
