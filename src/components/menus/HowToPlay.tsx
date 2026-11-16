import { useGameStore } from '../../stores/gameStore';
import Button from '../ui/Button';

const KEYS: [string, string][] = [
  ['W', 'Dive — point down for maximum speed'],
  ['S', 'Air brake — slow down and stabilize'],
  ['A / D', 'Steer left / right (bank into turns)'],
  ['SPACE', 'Jump from the ledge · then toggle glide'],
  ['SHIFT', 'Boost (drains the boost bar)'],
  ['C', 'Cycle camera: chase / first-person / wide'],
  ['MOUSE', 'Click the game to capture; move to steer'],
  ['ESC', 'Pause'],
];

export default function HowToPlay() {
  const setScreen = useGameStore((s) => s.setScreen);
  return (
    <div className="fade-in absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div className="glass max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-8">
        <h2 className="text-2xl font-light tracking-[0.4em]">HOW TO PLAY</h2>
        <div className="mt-6 grid gap-2">
          {KEYS.map(([k, d]) => (
            <div key={k} className="flex items-center gap-4 text-sm">
              <span className="w-24 shrink-0 rounded-md border border-white/25 px-2 py-1 text-center text-xs tracking-widest">{k}</span>
              <span className="text-white/75">{d}</span>
            </div>
          ))}
          <p className="mt-1 text-xs text-white/50">Gamepad: left stick steer/dive/brake · A jump/glide · RB/RT boost · Y camera · Start pause.</p>
        </div>
        <h3 className="mb-2 mt-8 text-xs tracking-[0.4em] text-sky-glow">THE GOAL</h3>
        <ul className="space-y-2 text-sm text-white/75">
          <li>• Fall from the summit through 10 stages to the paradise below. Land softly in the meadow beside the river (golden beacon).</li>
          <li>• Glide to stay near the glowing path; free fall and dive to lose height fast. The ground is a long way down — but it comes.</li>
          <li>• Fly through <span className="text-amber-300">amber rings</span> to bank checkpoints. Crash and you restart from the last one.</li>
          <li>• Avoid spires, boulders, caves' walls, trees and the ground. Birds, falling rocks and lightning only hurt.</li>
          <li>• Updrafts lift you, wind tunnels shove you, storm cells buffet you. Near misses and rings earn score.</li>
          <li>• Land with a downward speed under 28 m/s (use the air brake) in the final stage.</li>
        </ul>
        <div className="mt-8"><Button variant="primary" onClick={() => setScreen('menu')}>Back</Button></div>
      </div>
    </div>
  );
}
