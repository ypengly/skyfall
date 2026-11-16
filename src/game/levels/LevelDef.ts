import type { WeatherTarget, BiomeInfo } from '../../types';

export const LEVEL_LEN = 1400;
/** Time-of-day (hours, >24 = next day) at the start of each stage and at the very end. */
export const STAGE_HOURS = [6.6, 8.5, 11, 14, 18, 20, 22, 25, 27.5, 29.3, 31.0];

export interface LevelDef {
  id: number; name: string; subtitle: string;
  env: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'; envName: string;
  dStart: number; dEnd: number; parTime: number; hours: [number, number];
  weather: WeatherTarget; biome: BiomeInfo;
  pillars: number; boulders: number; gaps: number; caves: number; falling: number;
  updrafts: number; tunnels: number; turbs: number; snowCells: number; lightning: boolean;
  waterfalls: number; frozen: boolean; flocks: number; eagles: number; tip: string;
}

type Partial2 = Partial<Omit<LevelDef, 'id' | 'dStart' | 'dEnd' | 'hours' | 'weather' | 'biome'>> & {
  weather: Partial<WeatherTarget>; biome: Partial<BiomeInfo>;
};

export function makeLevel(id: number, p: Partial2 & { name: string; subtitle: string; env: LevelDef['env']; envName: string; tip: string }): LevelDef {
  return {
    pillars: 0, boulders: 0, gaps: 0, caves: 0, falling: 0, updrafts: 0, tunnels: 0, turbs: 0, snowCells: 0,
    lightning: false, waterfalls: 0, frozen: false, flocks: 2, eagles: 0, parTime: 30,
    ...p,
    id,
    dStart: (id - 1) * LEVEL_LEN,
    dEnd: id * LEVEL_LEN,
    hours: [STAGE_HOURS[id - 1], STAGE_HOURS[id]],
    weather: { rain: 0, snow: 0, fog: 0, storm: 0, wind: 0.2, cloud: 0.3, ...p.weather },
    biome: { snow: 0, green: 0, dark: 0, ...p.biome },
  };
}
