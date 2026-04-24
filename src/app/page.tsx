'use client';

import { useState } from 'react';
import { StateOrb, type DashboardSnapshot } from '@/components/dashboard/state-orb';
import type { OrbState } from '@/components/AgentOrb/AgentOrb';

const CONDUCTOR_STATES = ['idle', 'conscious', 'subconscious'] as const;

const MOCK_SNAPSHOTS: Record<string, DashboardSnapshot> = {
  idle: {
    conductor: { state: 'idle' },
    llm: null,
    tools: { running: null },
    queue: { channels: [{ queueDepth: 0 }] },
  },
  conscious: {
    conductor: { state: 'conscious' },
    llm: { inFlight: true },
    tools: { running: null },
    queue: { channels: [{ queueDepth: 0 }] },
  },
  'conscious+tool': {
    conductor: { state: 'conscious' },
    llm: { inFlight: true },
    tools: { running: 'web_search' },
    queue: { channels: [{ queueDepth: 2 }] },
  },
  subconscious: {
    conductor: { state: 'subconscious' },
    llm: null,
    tools: { running: null },
    queue: { channels: [{ queueDepth: 0 }] },
  },
};

export default function Home() {
  const [mode, setMode] = useState<string>('idle');
  const snapshot = MOCK_SNAPSHOTS[mode];

  return (
    <main className="fixed inset-0 bg-black">
      <StateOrb snapshot={snapshot} />
      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-8">
        {Object.keys(MOCK_SNAPSHOTS).map((key) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`font-mono text-sm tracking-wide transition-opacity ${
              mode === key
                ? 'text-white underline underline-offset-4'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </main>
  );
}
