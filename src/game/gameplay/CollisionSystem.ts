import type { V3 } from '../../types';
import { lerp } from '../../utils/math';
import { mountains } from '../world/MountainGenerator';
import type { Forest } from '../world/Forest';
import type { Wildlife } from '../world/Wildlife';
import type { ObstacleManager, Collider } from './ObstacleManager';

export interface CollisionResult {
  crash: string | null; ground: boolean; altitude: number;
  hits: ('bird' | 'rock' | 'lightning')[]; nearMiss: number; avoided: number; inCave: boolean;
}

const PR = 1.3; // player radius

/** Analytic collision against terrain, spires, boulders, caves, trees, birds, falling rocks and lightning. */
export class CollisionSystem {
  constructor(private obs: ObstacleManager, private forest: Forest, private wildlife: Wildlife) {}

  private clearance(c: Collider, p: V3): number {
    const dx = p.x - c.x, dz = p.z - c.z;
    if (c.kind === 'sphere') return Math.hypot(dx, p.y - c.y, dz) - c.r;
    if (c.kind === 'cyl') {
      const y0 = c.y0 as number, y1 = c.y1 as number, hd = Math.hypot(dx, dz);
      if (p.y < y0) return 1e9;
      const rr = lerp(c.r, c.rt as number, Math.min(1, (p.y - y0) / (y1 - y0))) * 0.94;
      if (p.y <= y1) return hd - rr;
      return Math.hypot(Math.max(hd - (c.rt as number), 0), p.y - y1);
    }
    const hl = c.hl as number, dxy = Math.hypot(dx, p.y - c.y), adz = Math.abs(dz);
    if (adz <= hl) return dxy < (c.rin as number) ? 1e9 : dxy - c.r;
    return Math.hypot(Math.max(dxy - c.r, 0), adz - hl);
  }

  check(p: V3, checkObstacles = true): CollisionResult {
    const res: CollisionResult = { crash: null, ground: false, altitude: 0, hits: [], nearMiss: 0, avoided: 0, inCave: false };
    const g = mountains.heightAt(p.x, p.z);
    res.altitude = p.y - g;
    if (res.altitude < PR * 0.9) { res.ground = true; res.crash = 'ground'; }
    if (!checkObstacles) return res;
    if (res.altitude < 70 && this.forest.mesh.visible && this.forest.hit(p.x, p.y, p.z)) res.crash = res.crash || 'tree';

    for (const c of this.obs.colliders) {
      const dz = p.z - c.z;
      if (dz < -c.r - 60 - (c.hl || 0) - (c.kind === 'cave' ? 0 : 0)) {
        if (!c.passed) { c.passed = true; if (c.minClear < 70 && !c.hit) res.avoided++; }
        continue;
      }
      if (dz > c.r + 130 + (c.hl || 0)) break; // sorted by d (= -z): the rest are farther ahead
      const cl = this.clearance(c, p);
      if (cl < c.minClear) c.minClear = cl;
      if (c.kind === 'cave') {
        const dxy = Math.hypot(p.x - c.x, p.y - c.y);
        if (Math.abs(dz) < (c.hl as number) && dxy < (c.rin as number)) res.inCave = true;
      }
      if (cl < PR) { c.hit = true; res.crash = res.crash || c.name; }
      else if (cl < 15 && !c.nm) { c.nm = true; res.nearMiss++; }
    }

    // birds
    const bp = this.wildlife.pos, bn = this.wildlife.count;
    for (let i = 0; i < bn; i++) {
      const o = i * 4;
      if (Math.abs(bp[o + 2] - p.z) > 8) continue;
      const d = Math.hypot(bp[o] - p.x, bp[o + 1] - p.y, bp[o + 2] - p.z);
      if (d < bp[o + 3] + PR) { res.hits.push('bird'); break; }
    }
    for (const f of this.obs.falling) {
      if (!f.alive) continue;
      const q = f.mesh.position;
      if (Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < f.r * 0.9 + PR) { f.alive = false; res.hits.push('rock'); }
    }
    if (this.obs.strikeActiveNear(p)) res.hits.push('lightning');
    return res;
  }
}
