'use client';

import { useEffect, useRef } from 'react';
import { Pane, type FolderApi } from 'tweakpane';
import { createOrbScene } from './orb-scene';
import { ORB_CONFIG } from './config';

export interface OrbLiveConfig {
  attractSpeed?: number;
  attractFreq?: number;
  cameraOrbitSpeed?: number;
  breathAmp?: number;
  breathFreq?: number;
  /** hex number e.g. 0xffffff */
  baseColor?: number;
  /** hex number e.g. 0xefa61e */
  consciousColor?: number;
  /** seconds; ~3×tau to fully settle. Omit to use scene default. */
  colorLerpTau?: number;
}

interface AgentOrbProps {
  liveConfig?: OrbLiveConfig;
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
  particleSize: { min: 0.1, max: 10, step: 0.05 },
  alphaAttenuation: { min: 0, max: 5, step: 0.01 },
  cameraDistance: { min: 0.2, max: 5, step: 0.01 },
  cameraOrbitSpeed: { min: -4, max: 4, step: 0.01 },

  'attract.freq': { min: 0, max: 20, step: 0.01 },
  'attract.speed': { min: -3, max: 3, step: 0.01 },
  'attract.maxStep': { min: 0, max: 0.1, step: 0.001 },
};

function bindObject(folder: FolderApi, source: Record<string, unknown>, path: string[], onChange: () => void): void {
  for (const key of Object.keys(source)) {
    const nextPath = [...path, key];
    const pathKey = nextPath.join('.');
    const value = source[key];

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

export function AgentOrb({ liveConfig }: AgentOrbProps) {
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
    if (!liveConfig) return;
    if (liveConfig.attractSpeed !== undefined) ORB_CONFIG.attract.speed = liveConfig.attractSpeed;
    if (liveConfig.attractFreq !== undefined) ORB_CONFIG.attract.freq = liveConfig.attractFreq;
    if (liveConfig.cameraOrbitSpeed !== undefined) ORB_CONFIG.cameraOrbitSpeed = liveConfig.cameraOrbitSpeed;
    sceneRef.current?.updateConfig();
    sceneRef.current?.setBreath(liveConfig.breathFreq ?? 0, liveConfig.breathAmp ?? 0);
    if (liveConfig.colorLerpTau !== undefined) {
      sceneRef.current?.setColorLerpTau(liveConfig.colorLerpTau);
    }
    sceneRef.current?.setColors(liveConfig.baseColor ?? 0xffffff, liveConfig.consciousColor ?? 0xffffff);
  }, [liveConfig]);

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
