'use client';

import { useEffect, useRef } from 'react';
import { Pane } from 'tweakpane';

// tweakpane v4 types don't resolve @tweakpane/core properly;
// at runtime Pane extends FolderApi which has addFolder / addBinding.
type TpFolder = {
  addFolder(params: { title: string; expanded?: boolean }): TpFolder;
  addBinding(obj: Record<string, unknown>, key: string, opts?: Record<string, unknown>): TpBinding;
};
type TpBinding = { label: string; on(event: string, cb: (ev: { value: unknown }) => void): void };
type TpPane = TpFolder & { dispose(): void };
import { createOrbScene } from './orb-scene';
import { ORB_CONFIG } from './config';

export interface OrbLiveConfig {
  attractSpeed?: number;
  attractFreq?: number;
  attractMaxStep?: number;
  cameraOrbitSpeed?: number;
  breathAmp?: number;
  breathFreq?: number;
  baseColor?: number;
  consciousColor?: number;
  colorLerpTau?: number;
}

interface AgentOrbProps {
  liveConfig?: OrbLiveConfig;
  presets?: Record<string, OrbLiveConfig>;
  onPresetChange?: () => void;
}

type NumericBinding = { min?: number; max?: number; step?: number };

const GEOMETRY_BINDINGS: Record<string, NumericBinding> = {
  particleCount: { min: 500, max: 30000, step: 100 },
  orbRadius: { min: 0.05, max: 0.7, step: 0.005 },
  radialJitter: { min: 0, max: 0.5, step: 0.001 },
  particleSize: { min: 0.1, max: 10, step: 0.05 },
  alphaAttenuation: { min: 0, max: 5, step: 0.01 },
  cameraDistance: { min: 0.2, max: 5, step: 0.01 },
};

const PRESET_BINDINGS: Record<string, NumericBinding> = {
  attractSpeed: { min: -3, max: 3, step: 0.01 },
  attractFreq: { min: 0, max: 20, step: 0.01 },
  attractMaxStep: { min: 0, max: 0.1, step: 0.001 },
  cameraOrbitSpeed: { min: -4, max: 4, step: 0.01 },
  breathAmp: { min: 0, max: 1, step: 0.001 },
  breathFreq: { min: 0, max: 20, step: 0.01 },
  colorLerpTau: { min: 0.05, max: 5, step: 0.01 },
};

function colorToHex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function bindPreset(folder: TpFolder, preset: OrbLiveConfig, onChange: () => void): void {
  for (const key of Object.keys(preset) as (keyof OrbLiveConfig)[]) {
    const value = preset[key];
    if (key === 'baseColor' || key === 'consciousColor') {
      const model = { value: colorToHex(value as number) };
      const binding = folder.addBinding(model, 'value', { view: 'color' });
      binding.label = key;
      binding.on('change', (ev: { value: unknown }) => {
        (preset as Record<string, unknown>)[key] = parseInt((ev.value as string).slice(1), 16);
        onChange();
      });
      continue;
    }
    if (typeof value === 'number') {
      const opts = PRESET_BINDINGS[key] ?? {};
      const binding = folder.addBinding(preset as Record<string, unknown>, key, opts);
      binding.on('change', onChange);
    }
  }
}

export function AgentOrb({ liveConfig, presets, onPresetChange }: AgentOrbProps) {
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
      ? new Pane({ title: 'Orb Controls', expanded: true, container: paneHost }) as unknown as TpPane
      : null;

    if (pane) {
      const geoFolder = pane.addFolder({ title: 'geometry', expanded: true });
      const cfg = ORB_CONFIG as unknown as Record<string, unknown>;
      for (const key of Object.keys(ORB_CONFIG) as (keyof typeof ORB_CONFIG)[]) {
        const value = ORB_CONFIG[key];
        if (typeof value === 'number') {
          const opts = GEOMETRY_BINDINGS[key] ?? {};
          const binding = geoFolder.addBinding(cfg, key, opts);
          binding.on('change', () => scene.updateConfig());
        }
      }

      if (presets) {
        for (const [name, preset] of Object.entries(presets)) {
          const f = pane.addFolder({ title: name, expanded: false });
          bindPreset(f, preset, () => onPresetChange?.());
        }
      }
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
    const s = sceneRef.current;
    if (!s) return;
    s.setAttract(liveConfig.attractFreq ?? 8.7, liveConfig.attractSpeed ?? -0.26, liveConfig.attractMaxStep ?? 0.02);
    s.setCameraOrbitSpeed(liveConfig.cameraOrbitSpeed ?? 0.3);
    s.setBreath(liveConfig.breathFreq ?? 0, liveConfig.breathAmp ?? 0);
    s.setColors(liveConfig.baseColor ?? 0xffffff, liveConfig.consciousColor ?? 0xffffff);
    if (liveConfig.colorLerpTau !== undefined) {
      s.setColorLerpTau(liveConfig.colorLerpTau);
    }
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
