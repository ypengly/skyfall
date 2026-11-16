import * as THREE from 'three';
import { clamp, lerp, mod, smoothstep } from '../../utils/math';

export interface SkyState {
  top: THREE.Color; horizon: THREE.Color; sunDir: THREE.Vector3; moonDir: THREE.Vector3;
  sunColor: THREE.Color; dayF: number; stars: number; elevation: number; hours: number;
}

const KEYS: { e: number; top: number[]; hor: number[] }[] = [
  { e: -0.3, top: [0.005, 0.01, 0.05], hor: [0.02, 0.03, 0.09] },
  { e: -0.1, top: [0.02, 0.04, 0.12], hor: [0.08, 0.1, 0.22] },
  { e: -0.02, top: [0.1, 0.14, 0.34], hor: [0.55, 0.32, 0.3] },
  { e: 0.05, top: [0.18, 0.3, 0.58], hor: [0.98, 0.52, 0.28] },
  { e: 0.18, top: [0.22, 0.42, 0.78], hor: [1.0, 0.75, 0.5] },
  { e: 0.45, top: [0.15, 0.4, 0.88], hor: [0.65, 0.8, 0.96] },
  { e: 1.0, top: [0.1, 0.36, 0.86], hor: [0.6, 0.78, 0.96] },
];

/** Smooth continuous sun/moon/sky model; time never snaps between day and night. */
export class DayNightCycle {
  hours = 6.6;
  state: SkyState = {
    top: new THREE.Color(), horizon: new THREE.Color(), sunDir: new THREE.Vector3(0, 1, 0), moonDir: new THREE.Vector3(0, -1, 0),
    sunColor: new THREE.Color(), dayF: 1, stars: 0, elevation: 1, hours: 6.6,
  };

  compute(): SkyState {
    const s = this.state;
    const a = ((this.hours - 6) / 12) * Math.PI;
    s.sunDir.set(Math.cos(a) * 0.9, Math.sin(a), -0.35).normalize();
    s.moonDir.set(-s.sunDir.x * 0.8 + 0.15, -s.sunDir.y * 0.85 + 0.12, -0.3).normalize();
    const e = s.sunDir.y;
    s.elevation = e;
    let i = 0;
    while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
    const k0 = KEYS[i], k1 = KEYS[i + 1];
    const t = clamp((e - k0.e) / (k1.e - k0.e), 0, 1);
    s.top.setRGB(lerp(k0.top[0], k1.top[0], t), lerp(k0.top[1], k1.top[1], t), lerp(k0.top[2], k1.top[2], t));
    s.horizon.setRGB(lerp(k0.hor[0], k1.hor[0], t), lerp(k0.hor[1], k1.hor[1], t), lerp(k0.hor[2], k1.hor[2], t));
    const warm = 1 - smoothstep(0.0, 0.5, e);
    s.sunColor.setRGB(1.0, lerp(0.95, 0.55, warm), lerp(0.86, 0.25, warm));
    s.dayF = smoothstep(-0.12, 0.22, e);
    s.stars = 1 - smoothstep(-0.18, 0.02, e);
    s.hours = this.hours;
    return s;
  }

  static clock(h: number) {
    const hh = mod(h, 24);
    const H = Math.floor(hh), M = Math.floor((hh - H) * 60);
    return `${H.toString().padStart(2, '0')}:${M.toString().padStart(2, '0')}`;
  }

  static label(h: number) {
    const x = mod(h, 24);
    if (x >= 4.5 && x < 5.8) return 'Dawn';
    if (x >= 5.8 && x < 7.2) return 'Sunrise';
    if (x < 11) return x >= 4.5 ? 'Morning' : 'Night';
    if (x < 14) return 'Midday';
    if (x < 16.5) return 'Afternoon';
    if (x < 18) return 'Golden Hour';
    if (x < 19) return 'Sunset';
    if (x < 20.3) return 'Twilight';
    return 'Night';
  }
}
