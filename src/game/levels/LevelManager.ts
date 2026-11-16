import type { BiomeInfo, WeatherTarget } from '../../types';
import { clamp, lerp, smoothstep } from '../../utils/math';
import { mountains, Z_MAX } from '../world/MountainGenerator';
import { LEVEL_LEN, LevelDef } from './LevelDef';
import { level01 } from './Level01';
import { level02 } from './Level02';
import { level03 } from './Level03';
import { level04 } from './Level04';
import { level05 } from './Level05';
import { level06 } from './Level06';
import { level07 } from './Level07';
import { level08 } from './Level08';
import { level09 } from './Level09';
import { level10 } from './Level10';

export class LevelManager {
  levels: LevelDef[] = [level01, level02, level03, level04, level05, level06, level07, level08, level09, level10];
  count = this.levels.length;

  idx(d: number) { return clamp(Math.floor(mountains.loopD(d) / LEVEL_LEN), 0, this.count - 1); }
  at(d: number) { return this.levels[this.idx(d)]; }
  get(i: number) { return this.levels[clamp(i, 0, this.count - 1)]; }
  progress(d: number) { return clamp(d / Z_MAX, 0, 1); }

  /** Biome with soft blending across stage boundaries. */
  biomeAt(d: number): BiomeInfo {
    const dd = mountains.loopD(d);
    const i = this.idx(dd);
    const cur = this.levels[i].biome;
    const out = { snow: cur.snow, green: cur.green, dark: cur.dark };
    const u = dd - this.levels[i].dStart, v = this.levels[i].dEnd - dd;
    const mix = (o: BiomeInfo, w: number) => { out.snow = lerp(out.snow, o.snow, w); out.green = lerp(out.green, o.green, w); out.dark = lerp(out.dark, o.dark, w); };
    if (u < 250 && i > 0) mix(this.levels[i - 1].biome, 0.5 * (1 - u / 250));
    else if (v < 250 && i < this.count - 1) mix(this.levels[i + 1].biome, 0.5 * (1 - v / 250));
    return out;
  }

  weatherAt(d: number): WeatherTarget { return this.at(d).weather; }

  hoursAt(d: number) {
    const dd = clamp(d, 0, Z_MAX);
    const l = this.at(dd);
    const f = smoothstep(0, 1, clamp((dd - l.dStart) / LEVEL_LEN, 0, 1));
    return lerp(l.hours[0], l.hours[1], clamp((dd - l.dStart) / LEVEL_LEN, 0, 1) * 0.5 + f * 0.5);
  }
}

export const levels = new LevelManager();
