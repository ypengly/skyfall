import { useGameStore } from '../../stores/gameStore';

const TIPS = [
  'Hold SPACE to glide. W dives, S brakes.',
  'Fly through glowing rings to bank checkpoints.',
  'Updraft columns give you lift.',
  'Slow down in fog — spires hide in the mist.',
  'Open the air brake before you land.',
];

export default function LoadingScreen() {
  const { progress, label } = useGameStore((s) => s.loading);
  const tip = TIPS[Math.floor(progress * TIPS.length) % TIPS.length];
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-[#05070f] via-[#0b1630] to-[#1b2f55]">
      <h1 className="title-glow text-5xl font-extralight tracking-[0.5em] sm:text-7xl">SKYFALL</h1>
      <p className="mt-3 text-xs tracking-[0.6em] text-white/50">THE LAST DESCENT</p>
      <div className="mt-16 h-[3px] w-72 overflow-hidden rounded bg-white/15">
        <div className="h-full bg-sky-glow transition-all duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="mt-4 text-xs tracking-widest text-white/60">{label.toUpperCase()}…</p>
      <p className="absolute bottom-10 text-xs text-white/40">{tip}</p>
    </div>
  );
}
