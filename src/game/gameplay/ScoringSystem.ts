import type { GameState } from '../core/GameState';
import { clamp } from '../../utils/math';

/** Score + performance rating. */
export class ScoringSystem {
  constructor(private s: GameState) {}

  gate() { this.s.gates++; this.s.score += 100; }
  guide() { this.s.score += 40; }
  checkpoint() { this.s.score += 250; }
  nearMiss() { this.s.nearMiss++; this.s.score += 60; }
  avoided(n: number) { this.s.avoided += n; this.s.score += n * 20; }
  distance(m: number) { this.s.score += m * 0.05; }
  hit() { this.s.hits++; this.s.score = Math.max(0, this.s.score - 150); }
  crash() { this.s.crashes++; this.s.score = Math.max(0, this.s.score - 400); }

  rating(parTime: number, completed: boolean): string {
    if (!completed) return '—';
    const s = this.s;
    const tf = clamp((parTime * 1.7 - s.time) / (parTime * 0.9), 0, 1);
    const perf = 0.5 * tf + 0.2 * (1 - Math.min(1, s.crashes / 5)) + 0.15 * (1 - Math.min(1, s.hits / 10)) + 0.15 * clamp(s.nearMiss / 12, 0, 1);
    return perf >= 0.85 ? 'S' : perf >= 0.7 ? 'A' : perf >= 0.5 ? 'B' : 'C';
  }
}
