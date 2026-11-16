import { useGameStore } from '../../stores/gameStore';
import { getGame } from '../../game/core/Game';
import { fmtTime } from '../../utils/math';
import { useUnits } from '../../hooks/useUnits';
import Button from '../ui/Button';

const RATING_COLOR: Record<string, string> = { S: 'text-amber-300', A: 'text-emerald-300', B: 'text-sky-glow', C: 'text-white/70' };

export default function Results() {
  const r = useGameStore((s) => s.results);
  const mode = useGameStore((s) => s.mode);
  const u = useUnits();
  if (!r) return null;
  const g = getGame();
  const title = r.mode === 'endless' ? 'THE FALL ENDS' : r.completed ? (r.mode === 'challenge' ? 'CHALLENGE COMPLETE' : 'TOUCHDOWN') : 'DESCENT FAILED';

  const rows: [string, string][] = [
    ['Total descent time', fmtTime(r.time)],
    ['Maximum speed', `${u.speed(r.maxSpeed)} ${u.unit}`],
    ['Distance traveled', u.dist(r.distance)],
    ['Checkpoints completed', mode === 'adventure' || mode === 'timetrial' ? `${r.checkpoints} / ${r.checkpointTotal}` : '—'],
    ['Obstacles avoided', String(r.avoided)],
    ['Near misses', String(r.nearMiss)],
    ['Hits / crashes', `${r.hits} / ${r.crashes}`],
  ];
  if (r.mode === 'endless') rows.push(['Total depth', `${Math.round(r.depth).toLocaleString()} m`]);

  return (
    <div className="fade-in absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="glass w-full max-w-lg rounded-2xl p-8">
        <p className="text-xs tracking-[0.5em] text-white/50">{r.reason.toUpperCase()}</p>
        <h2 className="title-glow mt-1 text-3xl font-extralight tracking-[0.3em]">{title}</h2>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className="text-[10px] tracking-[0.4em] text-white/50">PERFORMANCE</p>
            <p className={`text-7xl font-extralight leading-none ${RATING_COLOR[r.rating] ?? 'text-white'}`}>{r.rating}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.4em] text-white/50">SCORE</p>
            <p className="text-3xl font-light tabular-nums">{r.score.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-6 divide-y divide-white/10 text-sm">
          {rows.map(([k, v]) => (<div key={k} className="flex justify-between py-2"><span className="text-white/60">{k}</span><span className="tabular-nums">{v}</span></div>))}
        </div>

        {r.challenge && (
          <div className="mt-4 rounded-lg bg-black/30 p-3 text-sm">
            <p className="mb-1 tracking-widest text-sky-glow">{r.challenge.name.toUpperCase()}</p>
            {r.challenge.lines.map((l) => (<p key={l} className={l.startsWith('✓') ? 'text-emerald-300' : 'text-red-300'}>{l}</p>))}
          </div>
        )}

        <p className="mt-4 text-xs text-sky-glow">{r.newRecord ? '★ NEW PERSONAL RECORD  ' : ''}{r.bestLabel}</p>

        <div className="mt-6 flex gap-3">
          <Button variant="primary" onClick={() => getGame()?.retry()}>Retry</Button>
          <Button onClick={() => g?.toMenu()}>Main menu</Button>
        </div>
      </div>
    </div>
  );
}
