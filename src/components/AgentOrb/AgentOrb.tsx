'use client';

import { useEffect, useRef } from 'react';
import { createOrbScene, type OrbState } from './orb-scene';

export type { OrbState };

interface AgentOrbProps {
  state: OrbState;
}

export function AgentOrb({ state }: AgentOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ReturnType<typeof createOrbScene> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = createOrbScene(container);
    sceneRef.current = scene;

    const handleResize = () => {
      scene.resize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setState(state);
  }, [state]);

  return <div ref={containerRef} className="w-full h-full" />;
}
