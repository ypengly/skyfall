import * as THREE from 'three';
import { smoothstep, lerp } from '../../utils/math';
import { noise2 } from '../../utils/noise';
import { levels } from '../levels/LevelManager';
import { mountains } from './MountainGenerator';
import type { QualityPreset } from '../systems/PerformanceManager';

const ROCK_A = [0.42, 0.38, 0.35], ROCK_B = [0.27, 0.25, 0.24];
const GRASS = [0.17, 0.36, 0.12], GRASS2 = [0.26, 0.42, 0.14], SNOW = [0.88, 0.91, 0.96];

class Tile {
  mesh: THREE.Mesh;
  geo: THREE.PlaneGeometry;
  local: Float32Array;
  cell: number;
  cx = 1e9; cz = 1e9;

  constructor(public size: number, public segs: number, public snapMul: number, mat: THREE.Material, public far: boolean) {
    this.geo = new THREE.PlaneGeometry(size, size, segs, segs);
    this.geo.rotateX(-Math.PI / 2);
    const p = this.geo.attributes.position;
    this.local = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { this.local[i * 2] = p.getX(i); this.local[i * 2 + 1] = p.getZ(i); }
    this.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(p.count * 3), 3));
    this.cell = size / segs;
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
  }

  get snap() { return this.cell * this.snapMul; }

  rebuild(px: number, pz: number, force: boolean) {
    const cx = Math.round(px / this.snap) * this.snap, cz = Math.round(pz / this.snap) * this.snap;
    if (!force && cx === this.cx && cz === this.cz) return false;
    this.cx = cx; this.cz = cz;
    this.mesh.position.set(cx, 0, cz);
    const pos = this.geo.attributes.position as THREE.BufferAttribute;
    const col = this.geo.attributes.color as THREE.BufferAttribute;
    const S = this.segs + 1, half = this.size / 2;
    const lowR = 1024 + 640;
    const heights = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const lx = this.local[i * 2], lz = this.local[i * 2 + 1];
      let h = mountains.heightAt(cx + lx, cz + lz);
      if (this.far) {
        const r = Math.max(Math.abs(lx), Math.abs(lz));
        h -= 60 * (1 - smoothstep(lowR, lowR + 600, r));
      } else {
        const ix = i % S, iy = Math.floor(i / S);
        if (ix === 0 || iy === 0 || ix === this.segs || iy === this.segs) h -= 60;
      }
      heights[i] = h;
      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
    const nor = this.geo.attributes.normal as THREE.BufferAttribute;
    for (let iy = 0; iy < S; iy++) {
      const wz = cz + this.local[iy * S * 2 + 1];
      const d = -wz;
      const b = levels.biomeAt(d);
      const floor = mountains.floorAt(mountains.loopD(d));
      for (let ix = 0; ix < S; ix++) {
        const i = iy * S + ix;
        const wx = cx + this.local[i * 2];
        const ny = nor.getY(i), rel = heights[i] - floor;
        const n = noise2(wx * 0.02, wz * 0.02), n2 = noise2(wx * 0.07 + 5, wz * 0.07);
        let r = lerp(ROCK_A[0], ROCK_B[0], n), g = lerp(ROCK_A[1], ROCK_B[1], n), bl = lerp(ROCK_A[2], ROCK_B[2], n);
        const dk = 1 - 0.5 * b.dark; r *= dk; g *= dk; bl *= dk;
        const grass = b.green * smoothstep(0.76, 0.92, ny) * (1 - smoothstep(150, 900, rel));
        r = lerp(r, lerp(GRASS[0], GRASS2[0], n2), grass); g = lerp(g, lerp(GRASS[1], GRASS2[1], n2), grass); bl = lerp(bl, lerp(GRASS[2], GRASS2[2], n2), grass);
        const snow = b.snow * smoothstep(0.45, 0.8, ny) * (0.35 + 0.65 * smoothstep(0, 600, rel));
        r = lerp(r, SNOW[0], snow); g = lerp(g, SNOW[1], snow); bl = lerp(bl, SNOW[2], snow);
        col.setXYZ(i, r, g, bl);
      }
    }
    col.needsUpdate = true;
    return true;
  }

  dispose() { this.geo.dispose(); }
}

/** Two nested terrain meshes that follow the player (fine near mesh + coarse far mesh). */
export class Terrain {
  group = new THREE.Group();
  mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  near!: Tile; far!: Tile;
  private farPending = false;
  rebuiltNear = false;

  constructor(scene: THREE.Scene, preset: QualityPreset) {
    scene.add(this.group);
    this.setQuality(preset);
  }

  setQuality(p: QualityPreset) {
    if (this.near) { this.group.remove(this.near.mesh, this.far.mesh); this.near.dispose(); this.far.dispose(); }
    this.near = new Tile(p.nearSize, p.nearSegs, 4, this.mat, false);
    this.far = new Tile(p.farSize, p.farSegs, 2, this.mat, true);
    this.near.mesh.receiveShadow = p.shadows;
    this.group.add(this.far.mesh, this.near.mesh);
  }

  setShadows(on: boolean) { this.near.mesh.receiveShadow = on; }

  update(x: number, z: number, force = false) {
    this.rebuiltNear = false;
    if (force) { this.near.rebuild(x, z, true); this.far.rebuild(x, z, true); this.rebuiltNear = true; this.farPending = false; return; }
    if (this.farPending) { this.far.rebuild(x, z, false); this.farPending = false; return; }
    if (this.near.rebuild(x, z, false)) { this.rebuiltNear = true; }
    const fcx = Math.round(x / this.far.snap) * this.far.snap, fcz = Math.round(z / this.far.snap) * this.far.snap;
    if (fcx !== this.far.cx || fcz !== this.far.cz) this.farPending = true;
  }
}
