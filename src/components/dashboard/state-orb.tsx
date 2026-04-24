"use client";

import { useMemo } from "react";
import { AgentOrb } from "@/components/AgentOrb/AgentOrb";
import { PRESETS, type OrbLiveConfig } from "@/components/AgentOrb/config";

export interface DashboardSnapshot {
  conductor: { state: string };
  llm: { inFlight: boolean } | null;
  tools: { running: string | null };
  queue: { channels: Array<{ queueDepth: number }> };
}

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
    () => snapshot ? resolvePreset(snapshot) : PRESETS.idle,
    [snapshot]
  );

  return (
    <div className="h-full w-full">
      <AgentOrb liveConfig={liveConfig} />
    </div>
  );
}
