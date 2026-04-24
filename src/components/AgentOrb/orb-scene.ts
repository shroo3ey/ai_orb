import * as THREE from 'three';
import { VERTEX_SHADER } from './orb.vert.glsl';
import { FRAGMENT_SHADER } from './orb.frag.glsl';
import { ORB_CONFIG, type StateMotion } from './config';

export type OrbState = 'idle' | 'conscious';

export function createOrbGeometry(
  count: number,
  radius: number,
  radialJitter: number,
  coreRatio: number,
  coreRadiusRatio: number,
  coreConcentration: number,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const radialOffsets = new Float32Array(count);
  const phases = new Float32Array(count);
  const coreMask = new Float32Array(count);

  const coreCount = Math.floor(THREE.MathUtils.clamp(coreRatio, 0, 1) * count);
  const coreRadius = radius * Math.max(coreRadiusRatio, 0.0001);
  const concentration = Math.max(coreConcentration, 0.0001);

  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    if (i < coreCount) {
      const r = coreRadius * Math.pow(Math.random(), concentration);

      positions[i * 3 + 0] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = r * sinPhi * Math.sin(theta);
      positions[i * 3 + 2] = r * cosPhi;

      radialOffsets[i] = 0;
      coreMask[i] = 1;
    } else {
      const offset = (Math.random() * 2 - 1) * radialJitter;
      const r = radius * (1.0 + offset);

      positions[i * 3 + 0] = r * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = r * sinPhi * Math.sin(theta);
      positions[i * 3 + 2] = r * cosPhi;

      radialOffsets[i] = offset;
      coreMask[i] = 0;
    }

    seeds[i] = Math.random();
    phases[i] = Math.random();
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aRadialOffset', new THREE.BufferAttribute(radialOffsets, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aCore', new THREE.BufferAttribute(coreMask, 1));

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
      uColorCore: { value: new THREE.Color(ORB_CONFIG.colors.core) },
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

  const makeGeometry = () => createOrbGeometry(
    ORB_CONFIG.particleCount,
    ORB_CONFIG.orbRadius,
    ORB_CONFIG.radialJitter,
    ORB_CONFIG.core.ratio,
    ORB_CONFIG.core.radius,
    ORB_CONFIG.core.concentration,
  );

  let geometry = makeGeometry();
  const material = createOrbMaterial(pixelRatio);
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const geometryKey = () => `${ORB_CONFIG.particleCount}|${ORB_CONFIG.orbRadius}|${ORB_CONFIG.radialJitter}|${ORB_CONFIG.core.ratio}|${ORB_CONFIG.core.radius}|${ORB_CONFIG.core.concentration}`;
  let lastGeometryKey = geometryKey();

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

  const updateConfig = () => {
    const nextGeometryKey = geometryKey();
    if (nextGeometryKey !== lastGeometryKey) {
      const nextGeometry = makeGeometry();
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

    material.uniforms.uAttractFreq.value = ORB_CONFIG.attract.freq;
    material.uniforms.uAttractStrength.value = ORB_CONFIG.attract.strength;
    material.uniforms.uAttractExponent.value = ORB_CONFIG.attract.exponent;
    material.uniforms.uAttractDeadzone.value = ORB_CONFIG.attract.deadzone;
    material.uniforms.uAttractMaxStep.value = ORB_CONFIG.attract.maxStep;
    material.uniforms.uCenterPull.value = ORB_CONFIG.attract.centerPull;
    material.uniforms.uCenterPullFalloff.value = ORB_CONFIG.attract.centerFalloff;

    material.uniforms.uAxisVariance.value = ORB_CONFIG.axisVariance;
    material.uniforms.uTurbAmps.value.set(ORB_CONFIG.states.idle.turbAmp, ORB_CONFIG.states.conscious.turbAmp);
    material.uniforms.uNoiseFreqs.value.set(ORB_CONFIG.states.idle.noiseFreq, ORB_CONFIG.states.conscious.noiseFreq);
    material.uniforms.uBreathAmps.value.set(ORB_CONFIG.states.idle.breathAmp, ORB_CONFIG.states.conscious.breathAmp);

    const colorBase = material.uniforms.uColorBase.value as THREE.Color;
    const colorConscious = material.uniforms.uColorConscious.value as THREE.Color;
    const colorCore = material.uniforms.uColorCore.value as THREE.Color;
    colorBase.setHex(ORB_CONFIG.colors.base);
    colorConscious.setHex(ORB_CONFIG.colors.conscious);
    colorCore.setHex(ORB_CONFIG.colors.core);
  };

  updateConfig();

  const animate = () => {
    frameId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    const elapsed = (now - startTime) / 1000;

    stateUniform += (currentTarget - stateUniform) * (1 - Math.exp(-dt / ORB_CONFIG.lerpTau));

    const wIdle = Math.max(0, Math.min(1, 1 - Math.abs(stateUniform - 0)));
    const wCons = Math.max(0, Math.min(1, 1 - Math.abs(stateUniform - 1)));
    const s = ORB_CONFIG.states;
    const orbitSpeed = s.idle.orbitSpeed * wIdle + s.conscious.orbitSpeed * wCons;
    const noiseSpeed = s.idle.noiseSpeed * wIdle + s.conscious.noiseSpeed * wCons;
    const breathFreq = s.idle.breathFreq * wIdle + s.conscious.breathFreq * wCons;
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

  return { setState, updateConfig, resize, dispose };
}
