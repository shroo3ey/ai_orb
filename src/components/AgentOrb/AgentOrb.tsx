'use client';

import { useEffect, useRef } from 'react';
import { createOrbScene } from './orb-scene';
import { PRESETS, type OrbLiveConfig } from './config';

export type { OrbLiveConfig };

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
    if (!s) return;

    s.setLiveConfig(liveConfig ?? PRESETS.idle);
  }, [liveConfig]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
