import { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { getGame } from '../../game/core/Game';
import { useUnits } from '../../hooks/useUnits';
import { fmtTime } from '../../utils/math';

const FLIGHT: Record<string, string> = { standing: 'READY', freefall: 'FREE FALL', dive: 'DIVE', glide: 'GLIDE', brake: 'AIR BRAKE', landed: 'LANDED', crashed: 'CRASHED' };

export default function Hud() {
  const hud = useGameStore((s) => s.hud);
  const toast = useGameStore((s) => s.toast);
  const card = useGameStore((s) => s.levelCard);
  const mode = useGameStore((s) => s.mode);
  const screen = useGameStore((s) => s.screen);
  const u = useUnits();
  const [toastVis, setToastVis] = useState<typeof toast>(null);

  useEffect(() => {
    if (!toast) return;
    setToastVis(toast);
    const t = setTimeout(() => setToastVis(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const endless = mode === 'endless';
  const cps = Array.from({ length: 9 }, (_, i) => i + 1);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-display">
      {/* top-left: stage & weather */}
      <div className="absolute left-6 top-5 slide-up">
        <p className="text-[10px] tracking-[0.4em] text-white/50">{endless ? 'ENDLESS FALL' : `STAGE ${hud.levelNo} / 10`}</p>
        <p className="text-lg font-light tracking-wide">{hud.levelName}</p>
        <p className="text-xs text-white/60">{hud.envName} · {hud.weather}</p>
        {hud.windWarn && <p className="mt-1 text-xs font-medium tracking-widest text-sky-glow">⚠ {hud.windWarn.toUpperCase()}</p>}
      </div>

      {/* top-center: progress */}
      {!endless && (
        <div className="absolute left-1/2 top-5 w-[min(46vw,520px)] -translate-x-1/2">
          <div className="relative h-[3px] rounded bg-white/20">
            <div className="absolute left-0 top-0 h-full rounded bg-sky-glow" style={{ width: `${hud.progress * 100}%` }} />
            {cps.map((i) => (
              <span key={i} className={`absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${i <= hud.cpIndex ? 'bg-emerald-300' : 'bg-white/50'}`} style={{ left: `${(i / 10) * 100}%` }} />
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] tracking-[0.35em] text-white/50">CHECKPOINT {hud.cpIndex} / {hud.cpTotal}</p>
        </div>
      )}

      {/* top-right: time + pause */}
      <div className="absolute right-6 top-5 flex items-start gap-4">
        <div className="text-right">
          <p className="text-2xl font-light tabular-nums">{hud.clock}</p>
          <p className="text-[10px] tracking-[0.35em] text-white/50">{hud.todLabel.toUpperCase()}</p>
          <p className="mt-1 text-xs tabular-nums text-white/60">{fmtTime(hud.timer)}</p>
          {hud.fps > 0 && <p className="mt-1 text-[10px] text-white/40">{hud.fps} FPS</p>}
        </div>
        <button className="pointer-events-auto rounded-md border border-white/25 px-3 py-2 text-xs tracking-widest hover:bg-white/10"
          onClick={() => { getGame()?.pause(); }}>II</button>
      </div>

      {/* bottom-left: speed */}
      <div className="absolute bottom-8 left-8">
        <p className="text-6xl font-extralight tabular-nums leading-none">{u.speed(hud.speed)}<span className="ml-2 text-sm tracking-widest text-white/50">{u.unit.toUpperCase()}</span></p>
        <p className="mt-2 text-xs tracking-[0.35em] text-sky-glow">{FLIGHT[hud.flight] ?? ''}</p>
        <div className="mt-3 h-[3px] w-40 overflow-hidden rounded bg-white/15"><div className="h-full bg-amber-300 transition-all" style={{ width: `${hud.boost * 100}%` }} /></div>
        <p className="mt-1 text-[9px] tracking-[0.3em] text-white/40">BOOST</p>
      </div>

      {/* bottom-right: altitude + distance */}
      <div className="absolute bottom-8 right-8 text-right">
        <p className="text-3xl font-light tabular-nums">{u.alt(hud.altitude)}</p>
        <p className="text-[10px] tracking-[0.35em] text-white/50">ABOVE GROUND</p>
        <p className="mt-3 text-lg font-light tabular-nums">{endless ? `${Math.round(hud.depth).toLocaleString()} m` : u.dist(hud.distance)}</p>
        <p className="text-[10px] tracking-[0.35em] text-white/50">{endless ? 'TOTAL DEPTH' : 'TO DESTINATION'}</p>
        <p className="mt-3 text-xs tabular-nums text-white/60">SCORE {hud.score.toLocaleString()}</p>
      </div>

      {/* objective (challenge) */}
      {hud.objective && <p className="absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-black/35 px-5 py-2 text-xs tracking-widest text-white/80">{hud.objective}</p>}

      {/* level card */}
      {card && screen === 'playing' && (
        <div key={card.id + card.sub} className="level-card absolute left-1/2 top-[22%] -translate-x-1/2 text-center">
          <p className="text-xs tracking-[0.6em] text-white/60">{card.title}</p>
          <p className="title-glow mt-2 text-4xl font-extralight tracking-[0.25em] sm:text-5xl">{card.sub.split(' — ')[0].toUpperCase()}</p>
          <p className="mt-2 text-sm text-white/70">{card.sub.split(' — ')[1]}</p>
        </div>
      )}

      {/* toast */}
      {toastVis && (
        <div key={toastVis.id} className="slide-up absolute left-1/2 top-[38%] -translate-x-1/2">
          <p className={`rounded-full px-6 py-2 text-sm tracking-wide ${toastVis.kind === 'bad' ? 'bg-red-500/35 text-red-100' : toastVis.kind === 'good' ? 'bg-emerald-400/30 text-emerald-100' : 'bg-black/40 text-white/90'}`}>{toastVis.text}</p>
        </div>
      )}

      {hud.flight === 'standing' && screen === 'playing' && (
        <p className="absolute bottom-[18%] left-1/2 -translate-x-1/2 text-xs tracking-[0.5em] text-white/80 animate-pulse">PRESS SPACE TO JUMP</p>
      )}
    </div>
  );
}
