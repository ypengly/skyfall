import { clamp, lerp, smoothstep, mod } from '../../utils/math';
import { fbm, noise2 } from '../../utils/noise';

export const START_Y = 7000;
export const Z_MAX = 14000;

/**
 * Analytic description of the whole world. Everything (terrain mesh, collision,
 * rivers, obstacles, checkpoints) is derived from these functions so they always agree.
 * `d` is the distance travelled along the descent path (d = -z).
 */
export class MountainGenerator {
  endless = false;

  loopD(d: number) { return this.endless ? mod(d, Z_MAX) : d; }

  pathY(d: number) {
    d = this.loopD(d);
    if (d <= 0) return START_Y;
    const t = clamp(d / Z_MAX, 0, 1);
    const wig = 90 * Math.sin(d / 640) * smoothstep(0, 900, d) * (1 - smoothstep(12400, 14000, d));
    return START_Y * (1 - t) + wig;
  }

  pathX(d: number) {
    d = this.loopD(d);
    return (320 * Math.sin(d / 1900) + 140 * Math.sin(d / 730 + 1.3)) * smoothstep(0, 600, d) * (1 - smoothstep(12000, 14000, d));
  }

  private bump(d: number, a: number, b: number) { return smoothstep(a - 300, a, d) * (1 - smoothstep(b, b + 300, d)); }

  halfWidth(d: number) {
    d = this.loopD(d);
    return 430 - 200 * this.bump(d, 5600, 7000) - 170 * this.bump(d, 9800, 11200) - 90 * this.bump(d, 11200, 12600) + 1000 * smoothstep(12600, 14000, d);
  }

  clearance(d: number) {
    if (this.endless) return 320;
    return (700 - 380 * smoothstep(0, 2500, d)) * (1 - smoothstep(12200, 14000, d));
  }

  amp(d: number) {
    if (this.endless) return 1;
    d = this.loopD(d);
    return (0.55 + 0.45 * smoothstep(0, 1500, d)) * (1 - 0.85 * smoothstep(11800, 14000, d));
  }

  floorAt(d: number) { return this.pathY(d) - this.clearance(d); }
  riverMask(d: number) { d = this.loopD(d); return smoothstep(1800, 2400, d) * (1 - smoothstep(14000, 14800, d)); }
  riverWidth(d: number) { d = this.loopD(d); return 28 + 14 * noise2(d * 0.002, 3.1) + 70 * smoothstep(12600, 14000, d); }

  heightAt(x: number, z: number): number {
    const d = -z;
    const dd = this.loopD(d);
    const cx = this.pathX(dd), u = Math.abs(x - cx), hw = this.halfWidth(dd), a = this.amp(dd);
    const floor = this.pathY(dd) - this.clearance(dd);
    let h = floor + 1900 * a * smoothstep(hw, hw + 640, u);
    const s2 = smoothstep(hw, hw + 700, u);
    if (s2 > 0.001) {
      h += (fbm(x * 0.0016 + 11, z * 0.0016 + 7, 5) - 0.5) * 900 * a * s2;
      const r = 1 - Math.abs(2 * fbm(x * 0.0031, z * 0.0031, 4) - 1);
      h += r * r * 520 * a * smoothstep(hw + 100, hw + 900, u);
    }
    h += (fbm(x * 0.012 + 3, z * 0.012 + 9, 3) - 0.5) * 40 * (0.15 + 0.85 * smoothstep(hw, hw + 400, u));
    const rm = this.riverMask(dd);
    if (rm > 0) { const rw = this.riverWidth(dd); h -= 9 * rm * (1 - smoothstep(rw * 0.4, rw * 1.5, u)); }
    if (!this.endless && d < 400) {
      const q = (x / 60) * (x / 60) + ((z - 60) / 75) * ((z - 60) / 75);
      h = Math.max(h, floor + (START_Y - 3 - floor) * Math.exp(-q * q));
    }
    return h;
  }

  startPosition() {
    const x = 0, z = 25;
    return { x, z, y: this.heightAt(x, z) + 1.4 };
  }

  /** Heading (yaw) of the path at distance d. */
  pathYaw(d: number) {
    const dx = this.pathX(d + 30) - this.pathX(d - 30);
    return Math.atan2(dx, 60);
  }
}

export const mountains = new MountainGenerator();
export { lerp };
