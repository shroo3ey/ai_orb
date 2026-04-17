'use client';

import { useState } from 'react';
import { AgentOrb, type OrbState } from '@/components/AgentOrb/AgentOrb';

const STATES: OrbState[] = ['idle', 'conscious', 'subconscious', 'transitioning'];

export default function OrbDemoPage() {
  const [state, setState] = useState<OrbState>('idle');

  return (
    <main className="fixed inset-0 bg-black">
      <AgentOrb state={state} />
      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-8">
        {STATES.map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={`font-mono text-sm tracking-wide transition-opacity ${
              state === s
                ? 'text-white underline underline-offset-4'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </main>
  );
}
