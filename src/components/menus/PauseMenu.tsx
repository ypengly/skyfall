import { useGameStore } from '../../stores/gameStore';
import { getGame } from '../../game/core/Game';
import Button from '../ui/Button';
import Slider from '../ui/Slider';

const WEATHERS = ['auto', 'sunny', 'rain', 'storm', 'snow', 'fog', 'wind'];

export default function PauseMenu() {
  const mode = useGameStore((s) => s.mode);
  const openSettings = useGameStore((s) => s.openSettings);
  const explore = useGameStore((s) => s.explore);
  const setExplore = useGameStore((s) => s.setExplore);
  const g = getGame();

  return (
    <div className="fade-in absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className="glass w-full max-w-sm rounded-2xl p-8">
        <h2 className="mb-6 text-center text-2xl font-light tracking-[0.5em]">PAUSED</h2>
        <div className="flex flex-col gap-3">
          <Button variant="primary" onClick={() => g?.resume()}>Resume</Button>
          <Button onClick={() => g?.restartCheckpoint()}>Restart checkpoint</Button>
          <Button onClick={() => g?.restartLevel()}>Restart level</Button>
          <Button onClick={() => openSettings('paused')}>Settings</Button>
          <Button variant="danger" onClick={() => g?.toMenu()}>Main menu</Button>
        </div>
        {mode === 'exploration' && (
          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs tracking-[0.35em] text-sky-glow">EXPLORATION</p>
            <div className="mb-3 flex flex-wrap gap-1">
              {WEATHERS.map((w) => (
                <button key={w} onClick={() => setExplore({ weather: w })}
                  className={`rounded-md px-2.5 py-1 text-[11px] uppercase tracking-wider ${explore.weather === w ? 'bg-white text-slate-900' : 'border border-white/20 text-white/80 hover:bg-white/10'}`}>{w}</button>
              ))}
            </div>
            <Slider label="Time of day" value={explore.time ?? 9} min={5} max={29} step={0.1} format={(v) => `${String(Math.floor(v % 24)).padStart(2, '0')}:00`}
              onChange={(v) => setExplore({ time: v })} />
            <button className="mt-1 text-xs text-white/50 underline" onClick={() => setExplore({ time: null })}>Let time flow</button>
          </div>
        )}
      </div>
    </div>
  );
}
