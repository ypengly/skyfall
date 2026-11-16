import * as THREE from 'three';
import { clamp, mulberry32, smoothstep, wrapAround } from '../../utils/math';

/** World-fixed cloud sprites wrapped around the player; the player can fly through them. */
export class Clouds {
  group = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  private base: THREE.Vector3[] = [];
  private size: number[] = [];
  private thr: number[] = [];
  private active: number;
  inside = 0;
  private BX = 7000; private BY = 3600;

  constructor(scene: THREE.Scene, tex: THREE.Texture, max = 220) {
    const rng = mulberry32(777);
    for (let i = 0; i < max; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.8, color: 0xffffff });
      const s = new THREE.Sprite(mat);
      const sz = 260 + rng() * 620;
      s.scale.set(sz, sz * 0.55, 1);
      this.sprites.push(s); this.size.push(sz); this.thr.push(rng());
      this.base.push(new THREE.Vector3((rng() - 0.5) * this.BX, 300 + rng() * 7400, (rng() - 0.5) * 14000 - 6000));
      this.group.add(s);
    }
    this.active = max;
    scene.add(this.group);
  }

  setCount(n: number) { this.active = Math.min(n, this.sprites.length); for (let i = 0; i < this.sprites.length; i++) this.sprites[i].visible = i < this.active; }

  update(dt: number, cam: THREE.Vector3, wx: number, wz: number, cover: number, tint: THREE.Color, dayF: number) {
    let inside = 0;
    for (let i = 0; i < this.active; i++) {
      const b = this.base[i], s = this.sprites[i];
      b.x += wx * dt * 0.5; b.z += wz * dt * 0.5;
      const x = wrapAround(b.x, cam.x, this.BX), y = wrapAround(b.y, cam.y, this.BY), z = wrapAround(b.z, cam.z, this.BX * 1.4);
      s.position.set(x, y, z);
      const amt = clamp((cover * 1.15 - this.thr[i]) * 3, 0, 1);
      const dist = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
      const fade = smoothstep(30, this.size[i] * 0.5, dist);
      const m = s.material as THREE.SpriteMaterial;
      m.opacity = 0.85 * amt * (0.35 + 0.65 * fade);
      m.color.copy(tint);
      s.visible = amt > 0.02;
      if (amt > 0.3) { const r = this.size[i] * 0.42; if (dist < r) inside = Math.max(inside, (1 - dist / r) * amt); }
    }
    this.inside = inside;
  }
}
