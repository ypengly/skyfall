import { useRef } from 'react';
import { useGame } from './hooks/useGame';
import { useGameStore } from './stores/gameStore';
import LoadingScreen from './components/loading/LoadingScreen';
import MainMenu from './components/menus/MainMenu';
import GameModes from './components/menus/GameModes';
import SettingsMenu from './components/menus/SettingsMenu';
import HowToPlay from './components/menus/HowToPlay';
import PauseMenu from './components/menus/PauseMenu';
import Results from './components/menus/Results';
import Hud from './components/hud/Hud';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  useGame(canvasRef, fxRef);
  const screen = useGameStore((s) => s.screen);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black select-none">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <canvas ref={fxRef} className="pointer-events-none absolute inset-0 block h-full w-full" />
      {(screen === 'playing' || screen === 'paused') && <Hud />}
      {screen === 'menu' && <MainMenu />}
      {screen === 'modes' && <GameModes />}
      {screen === 'howto' && <HowToPlay />}
      {screen === 'settings' && <SettingsMenu />}
      {screen === 'paused' && <PauseMenu />}
      {screen === 'results' && <Results />}
      {screen === 'loading' && <LoadingScreen />}
    </div>
  );
}
