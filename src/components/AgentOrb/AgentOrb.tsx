'use client';

import { useEffect, useRef } from 'react';
import { Pane, type FolderApi } from 'tweakpane';
import { createOrbScene, type OrbState } from './orb-scene';
import { ORB_CONFIG } from './config';

export type { OrbState };

interface AgentOrbProps {
  state: OrbState;
}

type NumericBinding = {
  min?: number;
  max?: number;
  step?: number;
};

const NUMERIC_BINDINGS: Record<string, NumericBinding> = {
  particleCount: { min: 500, max: 30000, step: 100 },
  orbRadius: { min: 0.05, max: 0.7, step: 0.005 },
  radialJitter: { min: 0, max: 0.5, step: 0.001 },
  'core.ratio': { min: 0, max: 0.8, step: 0.01 },
  'core.radius': { min: 0.02, max: 0.95, step: 0.005 },
  'core.concentration': { min: 0.5, max: 6, step: 0.05 },
  pointSizeBase: { min: 0.1, max: 8, step: 0.05 },
  pointSizeScale: { min: 0.1, max: 10, step: 0.05 },
  alphaAttenuation: { min: 0, max: 5, step: 0.01 },
  cameraDistance: { min: 0.2, max: 5, step: 0.01 },
  cameraOrbitSpeed: { min: -4, max: 4, step: 0.01 },
  lerpTau: { min: 0.001, max: 2, step: 0.001 },

  'attract.freq': { min: 0, max: 20, step: 0.01 },
  'attract.speed': { min: -3, max: 3, step: 0.01 },
  'attract.strength': { min: 0, max: 100, step: 0.01 },
  'attract.exponent': { min: 0.1, max: 4, step: 0.01 },
  'attract.deadzone': { min: 0, max: 2, step: 0.001 },
  'attract.maxStep': { min: 0.001, max: 1, step: 0.001 },
  'attract.centerPull': { min: 0, max: 0.25, step: 0.0005 },
  'attract.centerFalloff': { min: 0, max: 4, step: 0.01 },

  axisVariance: { min: 0, max: 1, step: 0.001 },
  'pulse.amplitude': { min: 0, max: 2, step: 0.01 },
  'pulse.duration': { min: 0.01, max: 5, step: 0.01 },

  'states.idle.orbitSpeed': { min: -3, max: 3, step: 0.001 },
  'states.idle.turbAmp': { min: 0, max: 1, step: 0.001 },
  'states.idle.noiseFreq': { min: 0, max: 20, step: 0.01 },
  'states.idle.noiseSpeed': { min: -5, max: 5, step: 0.01 },
  'states.idle.breathFreq': { min: 0, max: 20, step: 0.01 },
  'states.idle.breathAmp': { min: 0, max: 1, step: 0.001 },
  'states.conscious.orbitSpeed': { min: -3, max: 3, step: 0.001 },
  'states.conscious.turbAmp': { min: 0, max: 1, step: 0.001 },
  'states.conscious.noiseFreq': { min: 0, max: 20, step: 0.01 },
  'states.conscious.noiseSpeed': { min: -5, max: 5, step: 0.01 },
  'states.conscious.breathFreq': { min: 0, max: 20, step: 0.01 },
  'states.conscious.breathAmp': { min: 0, max: 1, step: 0.001 },
};

function colorToHexString(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function bindObject(folder: FolderApi, source: Record<string, unknown>, path: string[], onChange: () => void): void {
  for (const key of Object.keys(source)) {
    const nextPath = [...path, key];
    const pathKey = nextPath.join('.');
    const value = source[key];

    if (pathKey === 'colors.base' || pathKey === 'colors.conscious' || pathKey === 'colors.core') {
      const colorModel = { value: colorToHexString(value as number) };
      const colorBinding = folder.addBinding(colorModel, 'value', { view: 'color' });
      colorBinding.label = key;
      colorBinding.on('change', (event: { value: string }) => {
        source[key] = parseInt(event.value.slice(1), 16);
        onChange();
      });
      continue;
    }

    if (typeof value === 'number') {
      const options = NUMERIC_BINDINGS[pathKey] ?? {};
      const binding = folder.addBinding(source, key, options);
      binding.on('change', onChange);
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedFolder = folder.addFolder({ title: key, expanded: path.length === 0 });
      bindObject(nestedFolder, value as Record<string, unknown>, nextPath, onChange);
    }
  }
}

export function AgentOrb({ state }: AgentOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paneHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ReturnType<typeof createOrbScene> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = createOrbScene(container);
    sceneRef.current = scene;

    const paneHost = paneHostRef.current;
    const pane = paneHost
      ? new Pane({ title: 'Orb Controls', expanded: true, container: paneHost })
      : null;

    if (pane) {
      bindObject(pane, ORB_CONFIG as unknown as Record<string, unknown>, [], () => {
        scene.updateConfig();
      });
    }

    scene.updateConfig();

    const handleResize = () => {
      scene.resize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      pane?.dispose();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setState(state);
  }, [state]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div
        ref={paneHostRef}
        className="absolute top-3 right-3 z-10 max-h-[calc(100%-1.5rem)] overflow-y-auto"
      />
    </div>
  );
}
