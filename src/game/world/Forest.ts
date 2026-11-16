import * as THREE from 'three';
import { hash1, smoothstep } from '../../utils/math';
import { noise2 } from '../../utils/noise';
import { mergeGeos, paint } from '../../utils/geometry';
import { levels } from '../levels/LevelManager';
import { mountains } from './MountainGenerator';

/** Instanced pines/broadleaf trees placed deterministically on the world grid around the player. */
export class Forest {
  mesh: THREE.InstancedMesh;
  max: number;
  count = 0;
  tx: Float32Array; tz: Float32Array; ty: Float32Array; th: Float32Array;
  private cx = 1e9; private cz = 1e9;
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private e = new THREE.Euler();
  private pv = new THREE.Vector3(); private sv = new THREE.Vector3(); private c = new THREE.Color();

  constructor(scene: THREE.Scene, max: number) {
    this.max = 9000;
    const trunk = paint(new THREE.CylinderGeometry(0.35, 0.55, 5, 6), 0.3, 0.2, 0.12); trunk.translate(0, 2.5, 0);
    const c1 = paint(new THREE.ConeGeometry(4.2, 9, 8), 0.13, 0.3, 0.12); c1.translate(0, 8, 0);
    const c2 = paint(new THREE.ConeGeometry(3.3, 8, 8), 0.15, 0.34, 0.13); c2.translate(0, 13, 0);
    const c3 = paint(new THREE.ConeGeometry(2.2, 7, 8), 0.18, 0.38, 0.15); c3.translate(0, 18, 0);
    const geo = mergeGeos([trunk, c1, c2, c3]);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.count = 0;
    this.tx = new Float32Array(this.max); this.tz = new Float32Array(this.max); this.ty = new Float32Array(this.max); this.th = new Float32Array(this.max);
    scene.add(this.mesh);
    this.setMax(max);
  }

  setMax(n: number) { this.max = Math.min(n, this.tx.length); this.cx = 1e9; }

  update(px: number, py: number, pz: number, ground: number, force = false) {
    const alt = py - ground;
    this.mesh.visible = alt < 900;
    if (!this.mesh.visible) return;
    const S = 48;
    const cx = Math.round(px / S) * S, cz = Math.round(pz / S) * S;
    if (!force && cx === this.cx && cz === this.cz) return;
    this.cx = cx; this.cz = cz;
    const cell = 20, R = 700, N = Math.floor(R / cell);
    let n = 0;
    const gx0 = Math.round(cx / cell), gz0 = Math.round(cz / cell);
    outer:
    for (let gi = -N; gi <= N; gi++) for (let gj = -N; gj <= N; gj++) {
      const ix = gx0 + gi, iz = gz0 + gj;
      const h0 = hash1(ix * 7.13 + iz * 3.71), h1 = hash1(ix * 1.77 - iz * 9.31 + 4), h2 = hash1(ix * 5.5 + iz * 2.2 - 8);
      const x = ix * cell + (h0 - 0.5) * cell * 0.9, z = iz * cell + (h1 - 0.5) * cell * 0.9;
      const d = -z, dd = mountains.loopD(d);
      const b = levels.biomeAt(dd);
      if (b.green < 0.25) continue;
      const clump = noise2(x * 0.008, z * 0.008);
      if (h2 > b.green * (0.25 + clump * 0.9) * 0.9) continue;
      // keep the landing meadow clear
      if (!mountains.endless && dd > 13150 && Math.abs(x - mountains.pathX(dd) - 170) < 230) continue;
      const y = mountains.heightAt(x, z);
      const sl = Math.abs(mountains.heightAt(x + 5, z) - y) + Math.abs(mountains.heightAt(x, z + 5) - y);
      if (sl > 3.2) continue;
      if (y - mountains.floorAt(dd) > 700) continue;
      const rw = mountains.riverWidth(dd);
      if (Math.abs(x - mountains.pathX(dd)) < rw * 0.9 && mountains.riverMask(dd) > 0.3) continue;
      const hgt = 0.6 + h2 * 1.3 + (levels.at(dd).env === 'C' ? 0.5 : 0);
      this.e.set(0, h0 * 6.283, 0); this.q.setFromEuler(this.e);
      this.pv.set(x, y - 0.5, z); this.sv.set(hgt, hgt, hgt);
      this.m.compose(this.pv, this.q, this.sv);
      this.mesh.setMatrixAt(n, this.m);
      this.c.setRGB(0.75 + h1 * 0.5, 0.8 + h0 * 0.4, 0.7 + h2 * 0.5);
      this.mesh.setColorAt(n, this.c);
      this.tx[n] = x; this.tz[n] = z; this.ty[n] = y; this.th[n] = 21 * hgt;
      n++;
      if (n >= this.max) break outer;
    }
    this.count = n; this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Cone collision (only called when close to the ground). */
  hit(x: number, y: number, z: number): boolean {
    for (let i = 0; i < this.count; i++) {
      const dx = x - this.tx[i], dz = z - this.tz[i];
      if (dx * dx + dz * dz > 100) continue;
      const rel = (y - this.ty[i]) / this.th[i];
      if (rel < 0 || rel > 1) continue;
      const r = 0.2 * this.th[i] * (1 - rel) + 0.6;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }
}
