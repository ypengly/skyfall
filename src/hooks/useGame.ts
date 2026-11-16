import { RefObject, useEffect } from 'react';
import { Game } from '../game/core/Game';

/** Creates the Game once, loads it progressively and tears it down on unmount. */
export function useGame(canvasRef: RefObject<HTMLCanvasElement>, fxRef: RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    if (!canvasRef.current || !fxRef.current) return;
    const game = new Game(canvasRef.current, fxRef.current);
    game.init().catch((e) => console.error('Game failed to start', e));
    return () => game.dispose();
  }, [canvasRef, fxRef]);
}
