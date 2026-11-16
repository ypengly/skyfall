import type { Quality } from '../../types';

export interface QualityPreset {
  pixelRatio: number; shadows: boolean; shadowMap: number;
  nearSize: number; nearSegs: number; farSize: number; farSegs: number;
  clouds: number; trees: number; rain: number; snow: number; leaves: number; lines: number; flockScale: number;
}

export const PRESETS: Record<Quality, QualityPreset> = {
  low:    { pixelRatio: 0.8,  shadows: false, shadowMap: 512,  nearSize: 1536, nearSegs: 64,  farSize: 16384, farSegs: 80,  clouds: 60,  trees: 700,  rain: 900,  snow: 900,  leaves: 80,  lines: 120, flockScale: 0.5 },
  medium: { pixelRatio: 1.0,  shadows: false, shadowMap: 1024, nearSize: 2048, nearSegs: 96,  farSize: 16384, farSegs: 104, clouds: 110, trees: 2200, rain: 1800, snow: 1800, leaves: 200, lines: 260, flockScale: 0.75 },
  high:   { pixelRatio: 1.5,  shadows: true,  shadowMap: 2048, nearSize: 2048, nearSegs: 128, farSize: 16384, farSegs: 128, clouds: 160, trees: 4500, rain: 2800, snow: 2800, leaves: 350, lines: 400, flockScale: 1 },
  ultra:  { pixelRatio: 2.0,  shadows: true,  shadowMap: 4096, nearSize: 2560, nearSegs: 192, farSize: 16384, farSegs: 160, clouds: 200, trees: 8000, rain: 3500, snow: 3500, leaves: 400, lines: 500, flockScale: 1 },
};

const ORDER: Quality[] = ['low', 'medium', 'high', 'ultra'];

/** Tracks FPS and (optionally) lowers/raises the quality preset automatically. */
export class PerformanceManager {
  quality: Quality = 'high';
  userQuality: Quality = 'high';
  adaptive = true;
  fps = 60;
  private acc = 0; private frames = 0; private lowT = 0; private highT = 0;

  preset(): QualityPreset { return PRESETS[this.quality]; }
  setUser(q: Quality) { this.userQuality = q; this.quality = q; this.lowT = 0; this.highT = 0; }

  /** Returns a new quality when adaptive scaling decides to change it. */
  update(dt: number, enabled: boolean): Quality | null {
    this.acc += dt; this.frames++;
    if (this.acc < 0.5) return null;
    this.fps = this.frames / this.acc; this.acc = 0; this.frames = 0;
    if (!enabled || !this.adaptive) return null;
    const i = ORDER.indexOf(this.quality);
    if (this.fps < 38) { this.lowT += 0.5; this.highT = 0; } else if (this.fps > 57) { this.highT += 0.5; this.lowT = 0; } else { this.lowT = 0; this.highT = 0; }
    if (this.lowT >= 3 && i > 0) { this.lowT = 0; this.quality = ORDER[i - 1]; return this.quality; }
    if (this.highT >= 20 && i < ORDER.indexOf(this.userQuality)) { this.highT = 0; this.quality = ORDER[i + 1]; return this.quality; }
    return null;
  }
}
