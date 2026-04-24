"use client";

import { useMemo } from "react";
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
  },
};

function resolvePreset(snap: DashboardSnapshot): OrbLiveConfig {
  if (snap.conductor.state === "idle") return PRESETS.idle;
  if (snap.conductor.state === "subconscious") return PRESETS.subconscious;
  if (snap.tools.running !== null) return PRESETS.tool;
  return PRESETS.conscious;
}

interface StateOrbProps {
  snapshot?: DashboardSnapshot | null;
}

export function StateOrb({ snapshot }: StateOrbProps) {
  const liveConfig = useMemo(
    () => (snapshot ? resolvePreset(snapshot) : PRESETS.idle),
    [snapshot]
  );

  return (
    <div className="h-full w-full">
      <AgentOrb liveConfig={liveConfig} />
    </div>
  );
}
