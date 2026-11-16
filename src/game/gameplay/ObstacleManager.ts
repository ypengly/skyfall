import * as THREE from 'three';
import type { V3 } from '../../types';
import { lerp, mulberry32, clamp } from '../../utils/math';
import { noise2 } from '../../utils/noise';
import { makeRockGeometry } from '../../utils/geometry';
import { levels } from '../levels/LevelManager';
import { mountains } from '../world/MountainGenerator';
import type { WindSystem } from '../environment/WindSystem';

export interface Collider {
  kind: 'sphere' | 'cyl' | 'cave'; solid: boolean; name: string;
  x: number; y: number; z: number; r: number;
  y0?: number; y1?: number; rt?: number; hl?: number; rin?: number;
  d: number; passed: boolean; hit: boolean; nm: boolean; minClear: number;
}
interface Falling { mesh: THREE.Mesh; vel: THREE.Vector3; r: number; alive: boolean; life: number }
interface Strike { x: number; z: number; top: number; bottom: number; t: number; state: 'warn' | 'strike'; mesh: THREE.Mesh; hitDone: boolean }

const rockOf = (b: { snow: number; dark: number }) => (b.snow > 0.5 ? 1 : b.dark > 0.4 ? 2 : 0);

export class ObstacleManager {
  group = new THREE.Group();
  colliders: Collider[] = [];
  falling: Falling[] = [];
  strikes: Strike[] = [];
  private rockGeos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[];
  private iceMat: THREE.Material;
  private darkInside = new THREE.MeshBasicMaterial({ color: 0x0b0c10, side: THREE.BackSide });
  private iceInside = new THREE.MeshBasicMaterial({ color: 0x1d3a55, side: THREE.BackSide });
  private zoneMeshes: THREE.Mesh[] = [];
  private fallTimer = 3; private strikeTimer = 4;
  bolt: THREE.LineSegments; private boltT = 0;
  onStrike: ((x: number, y: number, z: number) => void) | null = null;
  onRockSpawn: ((x: number, y: number, z: number) => void) | null = null;

  constructor(scene: THREE.Scene, private wind: WindSystem) {
    for (let i = 0; i < 6; i++) this.rockGeos.push(makeRockGeometry(i + 1, 2));
    this.mats = [
      new THREE.MeshLambertMaterial({ color: 0x7d746c, flatShading: true }),
      new THREE.MeshLambertMaterial({ color: 0xd8e0ea, flatShading: true }),
      new THREE.MeshLambertMaterial({ color: 0x45403e, flatShading: true }),
    ];
    this.iceMat = new THREE.MeshLambertMaterial({ color: 0x9ccbea, emissive: 0x16384f, flatShading: true });
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
    this.bolt = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0xdde8ff, transparent: true, opacity: 1, fog: false }));
    this.bolt.frustumCulled = false; this.bolt.visible = false;
    scene.add(this.group, this.bolt);
  }

  private add(c: Partial<Collider> & { kind: Collider['kind']; x: number; y: number; z: number; r: number; name: string; solid: boolean }) {
    this.colliders.push({ d: -c.z, passed: false, hit: false, nm: false, minClear: 1e9, ...c } as Collider);
  }

  resetFlags() { for (const c of this.colliders) { c.passed = false; c.hit = false; c.nm = false; c.minClear = 1e9; } }

  clear() {
    this.group.traverse((o: any) => { if (o.geometry && !this.rockGeos.includes(o.geometry)) o.geometry.dispose(); });
    this.group.clear();
    this.colliders = []; this.zoneMeshes = []; this.wind.zones = [];
    for (const f of this.falling) f.mesh.removeFromParent(); this.falling = [];
    for (const s of this.strikes) s.mesh.removeFromParent(); this.strikes = [];
  }

  build() {
    this.clear();
    for (const L of levels.levels) {
      const rng = mulberry32(5000 + L.id);
      const mat = this.mats[rockOf(L.biome)];
      const green = L.biome.green > 0.5;
      const near = (d: number, x: number, r: number) => {
        const m = d % 350; const k = Math.min(m, 350 - m);
        return k < 50 && Math.abs(x - mountains.pathX(d)) < r + 60;
      };
      // spires
      for (let k = 0; k < L.pillars; k++) {
        const d = L.dStart + 60 + rng() * 1280, hw = mountains.halfWidth(d);
        const x = mountains.pathX(d) + (rng() - 0.5) * 2 * hw * 0.78;
        const r = 12 + rng() * 20;
        if (near(d, x, r * 1.6) || d < 220) continue;
        this.addSpire(x, -d, r, mountains.pathY(d) + (rng() - 0.5) * 260, mat, green, k + L.id);
      }
      // narrow gaps (twin spires)
      for (let k = 0; k < L.gaps; k++) {
        const d = L.dStart + 220 + (k + 0.5) * (1100 / L.gaps) + (rng() - 0.5) * 60;
        const cx = mountains.pathX(d) + (rng() - 0.5) * mountains.halfWidth(d) * 0.5;
        const gap = 38, r = 30;
        const top = mountains.pathY(d) + 140;
        this.addSpire(cx - gap - r, -d, r, top, mat, false, 40 + k);
        this.addSpire(cx + gap + r, -d, r, top, mat, false, 50 + k);
      }
      // boulders embedded in the walls
      for (let k = 0; k < L.boulders; k++) {
        const d = L.dStart + 40 + rng() * 1320, side = rng() < 0.5 ? -1 : 1;
        const hw = mountains.halfWidth(d), cx = mountains.pathX(d);
        const yT = mountains.pathY(d) + (rng() - 0.5) * 220 + 40;
        let u = hw;
        while (u < hw + 800 && mountains.heightAt(cx + side * u, -d) < yT) u += 10;
        const r = 18 + rng() * 38;
        const x = cx + side * (u - r * 0.45);
        const m = new THREE.Mesh(this.rockGeos[k % 6], mat);
        m.position.set(x, yT, -d); m.scale.set(r, r * 0.9, r); m.rotation.set(rng() * 3, rng() * 6, 0);
        m.castShadow = true; this.group.add(m);
        this.add({ kind: 'sphere', solid: true, name: 'boulder', x, y: yT, z: -d, r: r * 0.92 });
      }
      // caves
      for (let k = 0; k < L.caves; k++) {
        const d = L.dStart + 780 + k * 100;
        const x = mountains.pathX(d) + (rng() - 0.5) * mountains.halfWidth(d) * 0.4;
        this.addCave(x, mountains.pathY(d) + 10, -d, L.frozen, mat);
      }
      // wind zones
      for (let k = 0; k < L.updrafts; k++) {
        const d = L.dStart + 200 + rng() * 1000, hw = mountains.halfWidth(d);
        const x = mountains.pathX(d) + (rng() - 0.5) * hw * 1.1, py = mountains.pathY(d);
        this.wind.zones.push({ type: 'up', x, y: py, z: -d, r: 85, y0: py - 300, y1: py + 380, strength: 17, name: 'Updraft' });
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(85, 85, 680, 20, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xa8dcff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
        cyl.position.set(x, py + 40, -d); this.group.add(cyl); this.zoneMeshes.push(cyl);
      }
      for (let k = 0; k < L.tunnels; k++) {
        const d = L.dStart + 250 + (k + 0.5) * (900 / L.tunnels);
        this.wind.zones.push({ type: 'tunnel', x: mountains.pathX(d), y: mountains.pathY(d), z: -d, r: mountains.halfWidth(d) * 0.95, hl: 150, strength: 22, name: 'Wind Tunnel' });
      }
      for (let k = 0; k < L.turbs; k++) {
        const d = L.dStart + 150 + rng() * 1100, hw = mountains.halfWidth(d);
        this.wind.zones.push({ type: 'turb', x: mountains.pathX(d) + (rng() - 0.5) * hw, y: mountains.pathY(d) + (rng() - 0.5) * 100, z: -d, r: 230, strength: 10, name: 'Turbulence' });
      }
      for (let k = 0; k < L.snowCells; k++) {
        const d = L.dStart + 200 + rng() * 1000, hw = mountains.halfWidth(d);
        this.wind.zones.push({ type: 'snow', x: mountains.pathX(d) + (rng() - 0.5) * hw, y: mountains.pathY(d), z: -d, r: 270, strength: 12, name: 'Snowstorm Cell' });
      }
    }
    this.colliders.sort((a, b) => a.d - b.d);
  }

  private addSpire(x: number, z: number, r: number, y1: number, mat: THREE.Material, green: boolean, seed: number) {
    const y0 = mountains.heightAt(x, z) - 15;
    if (y1 < y0 + 80) return;
    const h = y1 - y0, rb = r * 1.7, rt = r * 0.55;
    const g = new THREE.CylinderGeometry(rt, rb, h, 10, 5);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
      const k = 0.8 + 0.4 * noise2(px * 0.05 + seed * 3.1, pz * 0.05 + py * 0.02);
      p.setXYZ(i, px * k, py, pz * k);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.position.set(x, y0 + h / 2, z); m.castShadow = true;
    this.group.add(m);
    if (green) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rt * 1.3, rt * 3.2, 8), new THREE.MeshLambertMaterial({ color: 0x24512a }));
      cone.position.set(x, y1 + rt * 1.4, z); this.group.add(cone);
    }
    this.add({ kind: 'cyl', solid: true, name: 'spire', x, y: (y0 + y1) / 2, z, r: rb, rt, y0, y1 });
  }

  private addCave(x: number, y: number, z: number, ice: boolean, rock: THREE.Material) {
    const R = 58, rin = 22, hl = 85;
    const outer = new THREE.CylinderGeometry(R, R, hl * 2, 22, 6, true); outer.rotateX(Math.PI / 2);
    const p = outer.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
      const k = 0.85 + 0.3 * noise2(px * 0.06 + pz * 0.03, py * 0.06 + x);
      p.setXYZ(i, px * k, py * k, pz);
    }
    outer.computeVertexNormals();
    const mOuter = new THREE.Mesh(outer, ice ? this.iceMat : rock);
    const inner = new THREE.CylinderGeometry(rin, rin, hl * 2, 16, 1, true); inner.rotateX(Math.PI / 2);
    const mInner = new THREE.Mesh(inner, ice ? this.iceInside : this.darkInside);
    const capG = new THREE.RingGeometry(rin, R * 0.92, 22);
    const cap1 = new THREE.Mesh(capG, ice ? this.iceMat : rock); cap1.position.z = hl; cap1.material = (ice ? this.iceMat : rock);
    const cap2 = new THREE.Mesh(capG, ice ? this.iceMat : rock); cap2.position.z = -hl; cap2.rotation.y = Math.PI;
    const g = new THREE.Group(); g.add(mOuter, mInner, cap1, cap2); g.position.set(x, y, z);
    (cap1.material as any).side = THREE.DoubleSide; (cap2.material as any).side = THREE.DoubleSide;
    this.group.add(g);
    this.add({ kind: 'cave', solid: true, name: 'cave', x, y, z, r: R, rin, hl });
    // support stalk
    const floor = mountains.heightAt(x, z) - 15, top = y - R * 0.6;
    if (top > floor + 40) {
      const sg = new THREE.CylinderGeometry(24, 40, top - floor, 10, 3);
      const sm = new THREE.Mesh(sg, rock); sm.position.set(x, floor + (top - floor) / 2, z); this.group.add(sm);
      this.add({ kind: 'cyl', solid: true, name: 'spire', x, y: (floor + top) / 2, z, r: 40, rt: 24, y0: floor, y1: top });
    }
  }

  spawnGate(x: number, y: number, z: number) { /* gates are rings (CheckpointSystem); hook kept for challenge extensions */ void x; void y; void z; }

  update(dt: number, p: V3, v: V3, active: boolean, lightningLevel: boolean, fallRate: number, flashFn: (strong: boolean) => void) {
    // zone ring spin
    for (const z of this.zoneMeshes) z.rotation.y += dt * 0.6;

    if (active && fallRate > 0) {
      this.fallTimer -= dt;
      if (this.fallTimer <= 0) {
        this.fallTimer = 10 / fallRate * (0.6 + Math.random() * 0.8);
        const T = 5;
        const px = p.x + v.x * T + (Math.random() - 0.5) * 70, pz = p.z + v.z * T, py = p.y + v.y * T;
        const r = 5 + Math.random() * 6;
        const m = new THREE.Mesh(this.rockGeos[Math.floor(Math.random() * 6)], this.mats[2]);
        m.scale.set(r, r, r); m.position.set(px, py + 260, pz); this.group.add(m);
        this.falling.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 3, -52, 0), r, alive: true, life: 14 });
        this.onRockSpawn?.(px, py, pz);
      }
    }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.mesh.position.addScaledVector(f.vel, dt); f.mesh.rotation.x += dt * 2; f.mesh.rotation.z += dt * 1.3;
      f.life -= dt;
      const g = mountains.heightAt(f.mesh.position.x, f.mesh.position.z);
      if (!f.alive || f.life <= 0 || f.mesh.position.y < g) { f.mesh.removeFromParent(); this.falling.splice(i, 1); }
    }

    if (active && lightningLevel) {
      this.strikeTimer -= dt;
      if (this.strikeTimer <= 0) {
        this.strikeTimer = 3.5 + Math.random() * 3.5;
        const T = 1.8;
        const x = p.x + v.x * T + (Math.random() < 0.5 ? -1 : 1) * (22 + Math.random() * 45), z = p.z + v.z * T + (Math.random() - 0.5) * 30;
        const bottom = mountains.heightAt(x, z), top = p.y + 500;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, top - bottom, 6),
          new THREE.MeshBasicMaterial({ color: 0xff7a6a, transparent: true, opacity: 0.45, fog: false }));
        m.position.set(x, (top + bottom) / 2, z); this.group.add(m);
        this.strikes.push({ x, z, top, bottom, t: 1.5, state: 'warn', mesh: m, hitDone: false });
      }
    }
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t -= dt;
      const mat = s.mesh.material as THREE.MeshBasicMaterial;
      if (s.state === 'warn') {
        mat.opacity = 0.25 + 0.25 * Math.sin(s.t * 18);
        if (s.t <= 0) { s.state = 'strike'; s.t = 0.3; mat.color.set(0xffffff); mat.opacity = 1; s.mesh.scale.set(5, 1, 5); flashFn(true); this.onStrike?.(s.x, (s.top + s.bottom) / 2, s.z); }
      } else {
        mat.opacity = clamp(s.t / 0.3, 0, 1);
        if (s.t <= 0) { s.mesh.removeFromParent(); s.mesh.geometry.dispose(); this.strikes.splice(i, 1); }
      }
    }
    if (this.bolt.visible) { this.boltT -= dt; (this.bolt.material as THREE.LineBasicMaterial).opacity = clamp(this.boltT / 0.25, 0, 1); if (this.boltT <= 0) this.bolt.visible = false; }
  }

  /** Decorative far-away lightning bolt. */
  decorBolt(p: V3) {
    const ang = Math.random() * Math.PI * 2, dist = 1200 + Math.random() * 2200;
    let x = p.x + Math.cos(ang) * dist, z = p.z + Math.sin(ang) * dist;
    let y = p.y + 900 + Math.random() * 300;
    const g = mountains.heightAt(x, z);
    const arr = this.bolt.geometry.attributes.position as THREE.BufferAttribute;
    const n = 28; let i = 0;
    for (let s = 0; s < n; s++) {
      const ny = lerp(y, g, 1 / (n - s)) , nx = x + (Math.random() - 0.5) * 60, nz = z + (Math.random() - 0.5) * 60;
      arr.setXYZ(i++, x, y, z); arr.setXYZ(i++, nx, ny, nz);
      x = nx; y = ny; z = nz;
    }
    this.bolt.geometry.setDrawRange(0, i);
    arr.needsUpdate = true;
    this.bolt.visible = true; this.boltT = 0.25;
  }

  strikeActiveNear(p: V3): boolean {
    for (const s of this.strikes) {
      if (s.state !== 'strike' || s.hitDone) continue;
      if (Math.hypot(p.x - s.x, p.z - s.z) < 24 && p.y < s.top && p.y > s.bottom) { s.hitDone = true; return true; }
    }
    return false;
  }
}
