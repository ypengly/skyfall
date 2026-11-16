import type { WeatherState, WeatherTarget } from '../../types';
import { damp } from '../../utils/math';

export const WEATHER_PRESETS: Record<string, WeatherTarget> = {
  sunny: { rain: 0, snow: 0, fog: 0, storm: 0, wind: 0.15, cloud: 0.15 },
  rain: { rain: 0.8, snow: 0, fog: 0.25, storm: 0, wind: 0.5, cloud: 0.9 },
  storm: { rain: 1, snow: 0, fog: 0.3, storm: 1, wind: 1, cloud: 1 },
  snow: { rain: 0, snow: 1, fog: 0.35, storm: 0, wind: 0.6, cloud: 0.85 },
  fog: { rain: 0, snow: 0, fog: 1, storm: 0, wind: 0.1, cloud: 0.5 },
  wind: { rain: 0, snow: 0, fog: 0, storm: 0, wind: 1, cloud: 0.4 },
};

export interface WeatherCallbacks {
  onLightning: (thunderDelay: number, strong: boolean) => void;
}

/** Smoothly blends towards a target weather and drives lightning flashes. */
export class WeatherSystem {
  s: WeatherState = { rain: 0, snow: 0.1, fog: 0.05, storm: 0, wind: 0.25, cloud: 0.25 };
  flash = 0;
  private boltTimer = 4;
  private queue: number[] = [];

  snapTo(t: WeatherTarget) { this.s = { ...t }; this.flash = 0; this.queue.length = 0; }

  update(dt: number, target: WeatherTarget, cb: WeatherCallbacks) {
    const k = 0.45;
    const s = this.s;
    s.rain = damp(s.rain, target.rain, k, dt); s.snow = damp(s.snow, target.snow, k, dt);
    s.fog = damp(s.fog, target.fog, k, dt); s.storm = damp(s.storm, target.storm, k, dt);
    s.wind = damp(s.wind, target.wind, k, dt); s.cloud = damp(s.cloud, target.cloud, k, dt);

    this.flash = Math.max(0, this.flash - dt * 4.5);
    for (let i = this.queue.length - 1; i >= 0; i--) {
      this.queue[i] -= dt;
      if (this.queue[i] <= 0) { this.flash = Math.max(this.flash, 0.75); this.queue.splice(i, 1); }
    }
    if (s.storm > 0.45) {
      this.boltTimer -= dt * (0.5 + s.storm);
      if (this.boltTimer <= 0) {
        this.boltTimer = 2.5 + Math.random() * 6;
        this.flash = 1;
        if (Math.random() < 0.6) this.queue.push(0.12 + Math.random() * 0.1);
        const strong = Math.random() < 0.4;
        cb.onLightning(0.4 + Math.random() * 2.4, strong);
      }
    }
  }

  label(): string {
    const s = this.s;
    if (s.storm > 0.5) return 'Heavy Storm';
    if (s.rain > 0.35) return 'Rain';
    if (s.snow > 0.6) return 'Snowstorm';
    if (s.snow > 0.2) return 'Snow';
    if (s.fog > 0.45) return 'Dense Fog';
    if (s.fog > 0.2) return 'Fog';
    if (s.wind > 0.7) return 'Strong Wind';
    if (s.cloud > 0.7) return 'Overcast';
    if (s.wind > 0.4) return 'Windy';
    return 'Clear';
  }
}
