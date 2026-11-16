import * as THREE from 'three';
import type { V3 } from '../../types';
import { levels } from '../levels/LevelManager';
import { mountains, Z_MAX } from '../world/MountainGenerator';
import { mulberry32 } from '../../utils/math';

export type RingKind = 'cp' | 'guide' | 'gate';
export interface Ring {
  kind: RingKind; idx: number; d: number; pos: THREE.Vector3; r: number;
  passed: boolean; missed: boolean; mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; base: number;
}
export interface RingEvent { ring: Ring; success: boolean }

const COL = { cp: 0xffc14d, guide: 0x66e0ff, gate: 0xff6ad5, ok: 0x6dff8a, miss: 0xff5a5a };

/** Glowing checkpoint rings, guide rings, challenge gates and the landing beacon. */
export class CheckpointSystem {
  group = new THREE.Group();
  rings: Ring[] = [];
  beacon: THREE.Group;
  landing = new THREE.Vector3();
  private t = 0;

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.beacon = new THREE.Group();
    scene.add(this.beacon);
  }

  private makeRing(kind: RingKind, idx: number, d: number, x: number, y: number, r: number) {
    const tube = kind === 'cp' ? 3.4 : kind === 'gate' ? 1.8 : 1.5;
    const mat = new THREE.MeshBasicMaterial({ color: COL[kind], transparent: true, opacity: kind === 'guide' ? 0.75 : 0.95, fog: kind !== 'cp', depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 48), mat);
    mesh.position.set(x, y, -d);
    this.group.add(mesh);
    const ring: Ring = { kind, idx, d, pos: mesh.position, r, passed: false, missed: false, mesh, mat, base: COL[kind] };
    this.rings.push(ring);
    return ring;
  }

  build() {
    this.clear();
    // checkpoints at each stage end
    for (let i = 1; i <= 9; i++) {
      const d = levels.levels[i - 1].dEnd;
      this.makeRing('cp', i, d, mountains.pathX(d), mountains.pathY(d), 62);
    }
    for (let d = 350; d < 13700; d += 350) {
      if (d % 1400 === 0) continue;
      const rng = mulberry32(d);
      const dd = d + (rng() - 0.5) * 20;
      this.makeRing('guide', 0, dd, mountains.pathX(dd), mountains.pathY(dd), 46);
    }
    // landing beacon
    const dl = 13750;
    const lx = mountains.pathX(dl) + 170, lz = -dl;
    const ly = mountains.heightAt(lx, lz);
    this.landing.set(lx, ly, lz);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 520, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    beam.position.set(lx, ly + 260, lz);
    const disc = new THREE.Mesh(new THREE.RingGeometry(18, 30, 40), new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, fog: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(lx, ly + 1.2, lz);
    this.beacon.add(beam, disc);
    this.beacon.visible = !mountains.endless;
  }

  addGates(dStart: number, count: number) {
    const rng = mulberry32(dStart + 17);
    for (let i = 0; i < count; i++) {
      const d = dStart + 120 + i * ((1400 - 200) / count);
      const hw = mountains.halfWidth(d);
      const x = mountains.pathX(d) + (rng() - 0.5) * hw * 0.9;
      const y = mountains.pathY(d) + (rng() - 0.5) * 90;
      this.makeRing('gate', i + 1, d, x, y, 34);
    }
  }

  removeGates() {
    this.rings = this.rings.filter((r) => {
      if (r.kind !== 'gate') return true;
      this.group.remove(r.mesh); r.mesh.geometry.dispose(); r.mat.dispose(); return false;
    });
  }

  resetPassed() {
    for (const r of this.rings) { r.passed = false; r.missed = false; r.mat.color.setHex(r.base); r.mat.opacity = r.kind === 'guide' ? 0.75 : 0.95; }
  }

  /** Mark rings behind a given distance as passed (used when respawning mid-course). */
  setProgress(d: number, cpIndex: number) {
    for (const r of this.rings) {
      const behind = r.d < d - 5;
      r.passed = behind; r.missed = false;
      if (behind) { r.mat.color.setHex(r.kind === 'cp' && r.idx <= cpIndex ? COL.ok : r.base); r.mat.opacity = 0.35; }
      else { r.mat.color.setHex(r.base); r.mat.opacity = r.kind === 'guide' ? 0.75 : 0.95; }
    }
  }

  /** Detects plane crossings between two positions. */
  update(dt: number, prev: V3, cur: V3): RingEvent[] {
    this.t += dt;
    const out: RingEvent[] = [];
    for (const r of this.rings) {
      if (r.passed) continue;
      const z = r.pos.z;
      if (prev.z > z && cur.z <= z) {
        const f = (prev.z - z) / Math.max(prev.z - cur.z, 1e-6);
        const x = prev.x + (cur.x - prev.x) * f, y = prev.y + (cur.y - prev.y) * f;
        const dist = Math.hypot(x - r.pos.x, y - r.pos.y);
        const ok = dist < r.r * (r.kind === 'cp' ? 1.4 : r.kind === 'gate' ? 1.05 : 1.15);
        r.passed = true; r.missed = !ok;
        r.mat.color.setHex(ok ? COL.ok : COL.miss); r.mat.opacity = ok ? 0.5 : 0.3;
        out.push({ ring: r, success: ok });
      }
    }
    for (const r of this.rings) {
      if (!r.passed) { const s = 1 + 0.035 * Math.sin(this.t * 3 + r.d * 0.01); r.mesh.scale.setScalar(s); }
    }
    this.beacon.rotation.y += dt * 0.2;
    return out;
  }

  clear() {
    for (const r of this.rings) { this.group.remove(r.mesh); r.mesh.geometry.dispose(); r.mat.dispose(); }
    this.rings = [];
    this.beacon.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); });
    this.beacon.clear();
  }

  get finalD() { return Z_MAX; }
}
