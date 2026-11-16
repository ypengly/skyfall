import { useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getGame } from '../../game/core/Game';
import { CHALLENGES } from '../../game/levels/ChallengeDefs';
import Button from '../ui/Button';
import type { GameMode } from '../../types';

const MODES: { id: GameMode; name: string; desc: string }[] = [
  { id: 'adventure', name: 'Adventure', desc: 'The complete journey through all 10 stages, from the summit to the paradise below.' },
  { id: 'endless', name: 'Endless Fall', desc: 'An endless loop of procedurally shifting canyons. The winds grow stronger every lap. How deep can you fall?' },
  { id: 'timetrial', name: 'Time Trial', desc: 'Reach the ground as fast as you can. Dive, boost and thread the rings.' },
  { id: 'exploration', name: 'Exploration', desc: 'No crashes, no clock. Change the weather and time of day from the pause menu and just soar.' },
  { id: 'challenge', name: 'Challenge', desc: 'Hand-crafted routes with specific objectives.' },
];

export default function GameModes() {
  const setScreen = useGameStore((s) => s.setScreen);
  const save = useGameStore((s) => s.save);
  const [challengeOpen, setChallengeOpen] = useState(false);

  return (
    <div className="fade-in absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm">
      <div className="glass max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-8">
        <h2 className="text-2xl font-light tracking-[0.4em]">{challengeOpen ? 'CHALLENGES' : 'GAME MODES'}</h2>
        <div className="mt-6 grid gap-3">
          {!challengeOpen && MODES.map((m) => (
            <button key={m.id} className="rounded-xl border border-white/15 p-4 text-left transition hover:border-sky-glow/70 hover:bg-white/5"
              onClick={() => { if (m.id === 'challenge') setChallengeOpen(true); else getGame()?.startRun(m.id); }}>
              <p className="text-lg font-medium tracking-widest">{m.name.toUpperCase()}</p>
              <p className="mt-1 text-sm text-white/60">{m.desc}</p>
              {m.id === 'timetrial' && save.best.timetrial && <p className="mt-2 text-xs text-sky-glow">Best: {Math.floor(save.best.timetrial.time / 60)}:{String(Math.floor(save.best.timetrial.time % 60)).padStart(2, '0')}</p>}
              {m.id === 'endless' && save.best.endless && <p className="mt-2 text-xs text-sky-glow">Best depth: {save.best.endless.depth.toLocaleString()} m</p>}
            </button>
          ))}
          {challengeOpen && CHALLENGES.map((c, i) => (
            <button key={c.id} className="rounded-xl border border-white/15 p-4 text-left transition hover:border-sky-glow/70 hover:bg-white/5"
              onClick={() => getGame()?.startRun('challenge', { challengeIndex: i })}>
              <p className="flex items-center justify-between text-lg font-medium tracking-widest">
                <span>{c.id}. {c.name.toUpperCase()}</span>
                {save.challengesDone.includes(c.id) && <span className="text-xs text-emerald-300">✓ COMPLETE</span>}
              </p>
              <p className="mt-1 text-sm text-white/60">{c.desc}</p>
            </button>
          ))}
        </div>
        <div className="mt-6"><Button onClick={() => (challengeOpen ? setChallengeOpen(false) : setScreen('menu'))}>Back</Button></div>
      </div>
    </div>
  );
}
