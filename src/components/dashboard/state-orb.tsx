"use client";

import { useMemo } from "react";
import { AgentOrb, type OrbLiveConfig, type OrbState } from "@/components/AgentOrb/AgentOrb";

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

function computeLiveConfig(snap: DashboardSnapshot): OrbLiveConfig {
  const { conductor, llm, tools, queue } = snap;

  if (conductor.state === "idle") {
    return {
      attractSpeed: BASE_ATTRACT_SPEED,
      attractFreq: BASE_ATTRACT_FREQ,
      cameraOrbitSpeed: BASE_CAMERA_ORBIT_SPEED,
      breathAmp: 0,
      breathFreq: 0,
      baseColor: COLOR_WHITE,
      consciousColor: COLOR_WHITE,
      colorLerpTau: COLOR_TAU_DEFAULT,
    };
  }

  const llmActive = llm?.inFlight ?? false;
  const toolRunning = tools.running !== null;
  const queueBusy = queue.channels.some((c) => c.queueDepth > 0);

  // Stack activity signals
  let attractSpeed = BASE_ATTRACT_SPEED;
  let cameraOrbitSpeed = 0.4;
  let breathAmp = 0.06;
  let breathFreq = 0;
  let attractFreq = queueBusy ? 11 : BASE_ATTRACT_FREQ;
  let baseColor = COLOR_WHITE;
  let consciousColor = COLOR_GOLD;
  let colorLerpTau = COLOR_TAU_DEFAULT;

  if (llmActive) {
    attractSpeed = -0.45;
    breathAmp = 0.1;
    breathFreq = 2;
    consciousColor = COLOR_GOLD;
  }

  if (toolRunning) {
    attractSpeed = -0.6;
    cameraOrbitSpeed = 0.7;
    breathAmp = 0.13;
    breathFreq = 3;
    consciousColor = COLOR_ORANGE;
  }

  if (conductor.state === "subconscious") {
    attractSpeed = -0.15;
    cameraOrbitSpeed = 0.15;
    breathAmp = 0.04;
    breathFreq = 0.5;
    baseColor = COLOR_INDIGO;
    consciousColor = COLOR_INDIGO;
    colorLerpTau = COLOR_TAU_SUBCONSCIOUS;
  }

  return {
    attractSpeed,
    attractFreq,
    cameraOrbitSpeed,
    breathAmp,
    breathFreq,
    baseColor,
    consciousColor,
    colorLerpTau,
  };
}

const STATE_MAP: Record<string, OrbState> = {
  idle: "idle",
  conscious: "conscious",
  subconscious: "conscious",
  transitioning: "conscious",
};

interface StateOrbProps {
  snapshot?: DashboardSnapshot | null;
}

export function StateOrb({ snapshot }: StateOrbProps) {
  const state: OrbState = STATE_MAP[snapshot?.conductor.state ?? "idle"] ?? "idle";
  const liveConfig = useMemo(
    () => (snapshot ? computeLiveConfig(snapshot) : undefined),
    [snapshot]
  );

  return (
    <div className="h-full w-full">
      <AgentOrb state={state} liveConfig={liveConfig} />
    </div>
  );
}
