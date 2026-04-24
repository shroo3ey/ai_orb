'use client';

import { useEffect, useRef } from 'react';
import { createOrbScene } from './orb-scene';

export interface OrbLiveConfig {
  attractSpeed?: number;
  attractFreq?: number;
  attractMaxStep?: number;
  cameraOrbitSpeed?: number;
  breathAmp?: number;
  breathFreq?: number;
  baseColor?: number;
  consciousColor?: number;
}

interface AgentOrbProps {
  liveConfig?: OrbLiveConfig;
}

export function AgentOrb({ liveConfig }: AgentOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ReturnType<typeof createOrbScene> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = createOrbScene(container);
    sceneRef.current = scene;

    const handleResize = () => scene.resize(container.clientWidth, container.clientHeight);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const s = sceneRef.current;
    if (!liveConfig || !s) return;

    s.setAttract(liveConfig.attractFreq ?? 8.7, liveConfig.attractSpeed ?? -0.26, liveConfig.attractMaxStep ?? 0.02);
    s.setCameraOrbitSpeed(liveConfig.cameraOrbitSpeed ?? 0.3);
    s.setBreath(liveConfig.breathFreq ?? 0, liveConfig.breathAmp ?? 0);
    s.setColors(liveConfig.baseColor ?? 0xffffff, liveConfig.consciousColor ?? 0xffffff);
  }, [liveConfig]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
