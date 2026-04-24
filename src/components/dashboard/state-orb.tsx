"use client";

import { useMemo } from "react";
import { AgentOrb, type OrbLiveConfig } from "@/components/AgentOrb/AgentOrb";

// Colors
const COLOR_WHITE   = 0xffffff; // idle
const COLOR_GOLD    = 0xefa61e; // conscious / LLM thinking
const COLOR_ORANGE  = 0xff6b1a; // tool running
const COLOR_INDIGO  = 0x7b8ef7; // subconscious

const BASE_ATTRACT_SPEED = -0.26;
const BASE_ATTRACT_FREQ = 8.7;
const BASE_CAMERA_ORBIT_SPEED = 0.3;

// Color lerp time constants (seconds). Subconscious is stretched so the indigo
// visibly blooms in rather than snapping.
const COLOR_TAU_DEFAULT = 0.9;
const COLOR_TAU_SUBCONSCIOUS = 2.2;

export interface DashboardSnapshot {
  conductor: { state: string };
  llm: { inFlight: boolean } | null;
  tools: { running: string | null };
  queue: { channels: Array<{ queueDepth: number }> };
}

const PRESETS: Record<string, OrbLiveConfig> = {
  idle: {
    attractSpeed: BASE_ATTRACT_SPEED,
    attractFreq: BASE_ATTRACT_FREQ,
    cameraOrbitSpeed: BASE_CAMERA_ORBIT_SPEED,
    breathAmp: 0,
    breathFreq: 0,
    baseColor: COLOR_WHITE,
    consciousColor: COLOR_WHITE,
    colorLerpTau: COLOR_TAU_DEFAULT,
  },
  conscious: {
    attractSpeed: -0.45,
    attractFreq: BASE_ATTRACT_FREQ,
    cameraOrbitSpeed: 0.4,
    breathAmp: 0.1,
    breathFreq: 2,
    baseColor: COLOR_WHITE,
    consciousColor: COLOR_GOLD,
    colorLerpTau: COLOR_TAU_DEFAULT,
  },
  tool: {
    attractSpeed: -0.6,
    attractFreq: 11,
    cameraOrbitSpeed: 0.7,
    breathAmp: 0.13,
    breathFreq: 3,
    baseColor: COLOR_WHITE,
    consciousColor: COLOR_ORANGE,
    colorLerpTau: COLOR_TAU_DEFAULT,
  },
  subconscious: {
    attractSpeed: -0.15,
    attractFreq: BASE_ATTRACT_FREQ,
    cameraOrbitSpeed: 0.15,
    breathAmp: 0.04,
    breathFreq: 0.5,
    baseColor: COLOR_INDIGO,
    consciousColor: COLOR_INDIGO,
    colorLerpTau: COLOR_TAU_SUBCONSCIOUS,
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
