import type { V3 } from '../../types';
import { clamp, smoothstep } from '../../utils/math';
import type { WindSample } from '../player/PlayerPhysics';

export interface WindZone {
  type: 'up' | 'tunnel' | 'turb' | 'snow';
  x: number; y: number; z: number; r: number; hl?: number; y0?: number; y1?: number; strength: number; name: string;
}

/** Global wind + gusts + local wind zones (updrafts, tunnels, storm cells). */
export class WindSystem {
  zones: WindZone[] = [];
  private t = 0;
  private speed = 3;
  private ang = 1.2;
  base = { x: 0, z: 0 };
  /** Strength multiplier (endless mode ramps this up). */
  scale = 1;
  zoneName = '';
  zoneFog = 0;

  update(dt: number, wind01: number) {
    this.t += dt;
    this.speed = (2 + wind01 * 16) * this.scale;
    this.ang = 1.2 + 0.5 * Math.sin(this.t * 0.04);
    const gust = 0.75 + 0.25 * Math.sin(this.t * 0.7) + 0.2 * Math.sin(this.t * 1.9 + 1.3);
    this.base.x = Math.cos(this.ang) * this.speed * gust;
    this.base.z = Math.sin(this.ang) * this.speed * gust * 0.6;
  }

  sample(p: V3, wind01: number, storm: number, out: WindSample): WindSample {
    out.x = this.base.x; out.y = 0; out.z = this.base.z;
    let turb = clamp(wind01 * 0.35 + storm * 0.5, 0, 1.2);
    this.zoneName = ''; this.zoneFog = 0;
    for (let i = 0; i < this.zones.length; i++) {
      const zn = this.zones[i];
      const dz = Math.abs(p.z - zn.z);
      if (dz > 400) continue;
      const dx = p.x - zn.x, dy = p.y - zn.y;
      if (zn.type === 'up') {
        const hd = Math.hypot(dx, p.z - zn.z);
        if (hd < zn.r && p.y > (zn.y0 as number) && p.y < (zn.y1 as number)) {
          const f = 1 - smoothstep(0.4, 1, hd / zn.r);
          out.y += zn.strength * f; turb += 0.25 * f; this.zoneName = 'Updraft';
        }
      } else if (zn.type === 'tunnel') {
        if (dz < (zn.hl as number) && Math.abs(dy) < 300 && Math.abs(dx) < zn.r) {
          const f = smoothstep(0, 40, (zn.hl as number) - dz);
          out.x += Math.sin(p.z * 0.018 + zn.x) * zn.strength * f;
          out.z -= zn.strength * 0.5 * f; turb += 0.7 * f; this.zoneName = 'Wind Tunnel';
        }
      } else {
        const dist = Math.hypot(dx, dy, p.z - zn.z);
        if (dist < zn.r) {
          const f = 1 - smoothstep(0.3, 1, dist / zn.r);
          out.x += Math.sin(this.t * 2.1 + zn.x) * zn.strength * f; out.y += Math.sin(this.t * 1.7 + zn.z) * zn.strength * 0.5 * f;
          turb += (zn.type === 'snow' ? 0.9 : 1.0) * f;
          if (zn.type === 'snow') this.zoneFog = Math.max(this.zoneFog, f);
          this.zoneName = zn.type === 'snow' ? 'Snowstorm Cell' : 'Turbulence';
        }
      }
    }
    out.turb = clamp(turb, 0, 1.6);
    return out;
  }
}
