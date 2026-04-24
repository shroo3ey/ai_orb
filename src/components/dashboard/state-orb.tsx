"use client";

import { useCallback, useMemo, useReducer } from "react";
import { AgentOrb, type OrbLiveConfig } from "@/components/AgentOrb/AgentOrb";

export interface DashboardSnapshot {
  conductor: { state: string };
  llm: { inFlight: boolean } | null;
  tools: { running: string | null };
  queue: { channels: Array<{ queueDepth: number }> };
}

export const PRESETS: Record<string, OrbLiveConfig> = {
  idle: {
    attractSpeed: -0.26,
    attractFreq: 8.7,
    attractMaxStep: 0.02,
    cameraOrbitSpeed: 0.3,
    breathAmp: 0,
    breathFreq: 0,
    baseColor: 0xffffff,
    consciousColor: 0xffffff,
    colorLerpTau: 0.9,
  },
  conscious: {
    attractSpeed: -0.45,
    attractFreq: 8.7,
    attractMaxStep: 0.02,
    cameraOrbitSpeed: 0.4,
    breathAmp: 0.1,
    breathFreq: 2,
    baseColor: 0xffffff,
    consciousColor: 0xefa61e,
    colorLerpTau: 0.9,
  },
  tool: {
    attractSpeed: -0.6,
    attractFreq: 11,
    attractMaxStep: 0.02,
    cameraOrbitSpeed: 0.7,
    breathAmp: 0.13,
    breathFreq: 3,
    baseColor: 0xffffff,
    consciousColor: 0xff6b1a,
    colorLerpTau: 0.9,
  },
  subconscious: {
    attractSpeed: -0.15,
    attractFreq: 8.7,
    attractMaxStep: 0.02,
    cameraOrbitSpeed: 0.15,
    breathAmp: 0.04,
    breathFreq: 0.5,
    baseColor: 0x7b8ef7,
    consciousColor: 0x7b8ef7,
    colorLerpTau: 2.2,
  },
};

function resolvePreset(snap: DashboardSnapshot): OrbLiveConfig {
  const { conductor, llm, tools } = snap;

  switch (conductor.state) {
    case "idle":
      return PRESETS.idle;
    case "subconscious":
      return PRESETS.subconscious;
    default: {
      if (tools.running !== null) return PRESETS.tool;
      if (llm?.inFlight) return PRESETS.conscious;
      return PRESETS.conscious;
    }
  }
}

interface StateOrbProps {
  snapshot?: DashboardSnapshot | null;
}

export function StateOrb({ snapshot }: StateOrbProps) {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const liveConfig = useMemo(
    () => (snapshot ? resolvePreset(snapshot) : PRESETS.idle),
    [snapshot]
  );

  const handlePresetChange = useCallback(() => {
    forceUpdate();
  }, []);

  return (
    <div className="h-full w-full">
      <AgentOrb liveConfig={liveConfig} presets={PRESETS} onPresetChange={handlePresetChange} />
    </div>
  );
}
