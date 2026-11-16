import { useGameStore } from '../../stores/gameStore';
import { getGame } from '../../game/core/Game';
import Button from '../ui/Button';

export default function MainMenu() {
  const save = useGameStore((s) => s.save);
  const setScreen = useGameStore((s) => s.setScreen);
  const openSettings = useGameStore((s) => s.openSettings);
  const canContinue = !!save.adventure && save.adventure.cp > 0;

  return (
    <div className="fade-in absolute inset-0 z-20 flex items-center bg-gradient-to-r from-black/55 via-black/15 to-transparent">
      <div className="ml-[7vw] max-w-xl">
        <h1 className="title-glow text-6xl font-extralight tracking-[0.35em] sm:text-8xl">SKYFALL</h1>
        <p className="mt-3 text-sm tracking-[0.75em] text-white/70 sm:text-base">THE LAST DESCENT</p>
        <div className="mt-14 flex w-64 flex-col gap-3">
          <Button variant="primary" onClick={() => getGame()?.startRun('adventure')}>Play</Button>
          <Button disabled={!canContinue} onClick={() => getGame()?.startRun('adventure', { fromSave: true })}>
            Continue{canContinue ? ` · CP ${save.adventure!.cp}` : ''}
          </Button>
          <Button onClick={() => setScreen('modes')}>Game Modes</Button>
          <Button onClick={() => openSettings('menu')}>Settings</Button>
          <Button onClick={() => setScreen('howto')}>How to Play</Button>
        </div>
        <p className="mt-10 text-xs text-white/40">
          {save.best.adventure ? `Best adventure: ${Math.floor(save.best.adventure.time / 60)}:${String(Math.floor(save.best.adventure.time % 60)).padStart(2, '0')} · rank ${save.best.adventure.rating}` : 'Jump from the edge of the world.'}
        </p>
      </div>
    </div>
  );
}
