import * as THREE from 'three';
import { clamp } from '../../utils/math';

/** Streaks (rain / speed lines). Particles live in camera-relative space so they stream past the falling player. */
export class RainField {
  mesh: THREE.LineSegments;
  private rel: Float32Array;
  private pos: Float32Array;
  private geo = new THREE.BufferGeometry();
  private mat: THREE.LineBasicMaterial;
  active = 0;

  constructor(scene: THREE.Scene, private max: number, private box: number, color: number, private baseOpacity: number,
              public fall: THREE.Vector3, private lenScale: number, private maxLen: number) {
    this.rel = new Float32Array(max * 3);
    this.pos = new Float32Array(max * 6);
    for (let i = 0; i < max * 3; i++) this.rel[i] = (Math.random() - 0.5) * 2 * box;
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: baseOpacity, depthWrite: false, fog: false });
    this.mesh = new THREE.LineSegments(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  setMax(n: number) { this.max = Math.min(n, this.rel.length / 3); }

  update(dt: number, cam: THREE.Vector3, pv: { x: number; y: number; z: number }, intensity: number) {
    const n = Math.floor(Math.min(this.max, this.rel.length / 3) * clamp(intensity, 0, 1));
    this.active = n;
    this.mesh.visible = n > 2;
    if (!this.mesh.visible) return;
    this.mat.opacity = this.baseOpacity * Math.min(1, intensity * 1.6);
    const b = this.box, B = 2 * b;
    const rvx = this.fall.x - pv.x, rvy = this.fall.y - pv.y, rvz = this.fall.z - pv.z;
    const len = Math.min(this.maxLen, Math.hypot(rvx, rvy, rvz) * this.lenScale);
    const sp = Math.hypot(rvx, rvy, rvz) || 1;
    const tx = (rvx / sp) * len, ty = (rvy / sp) * len, tz = (rvz / sp) * len;
    const r = this.rel, p = this.pos;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      let x = r[j] + rvx * dt, y = r[j + 1] + rvy * dt, z = r[j + 2] + rvz * dt;
      x = ((x + b) % B + B) % B - b; y = ((y + b) % B + B) % B - b; z = ((z + b) % B + B) % B - b;
      r[j] = x; r[j + 1] = y; r[j + 2] = z;
      const o = i * 6;
      p[o] = cam.x + x; p[o + 1] = cam.y + y; p[o + 2] = cam.z + z;
      p[o + 3] = p[o] - tx; p[o + 4] = p[o + 1] - ty; p[o + 5] = p[o + 2] - tz;
    }
    this.geo.setDrawRange(0, n * 2);
    this.geo.attributes.position.needsUpdate = true;
  }
}

export interface ParticleOpts {
  max: number; box: number; size: number; colors: number[]; opacity: number; vel: THREE.Vector3;
  sway?: number; flutter?: number; additive?: boolean;
}

/** Point sprites (snow, leaves, debris, butterflies) in camera-relative space. */
export class ParticleField {
  points: THREE.Points;
  private rel: Float32Array; private pos: Float32Array; private phase: Float32Array;
  private geo = new THREE.BufferGeometry();
  private mat: THREE.PointsMaterial;
  private t = 0;
  vel: THREE.Vector3;
  limit: number;

  constructor(scene: THREE.Scene, tex: THREE.Texture, private o: ParticleOpts) {
    this.limit = o.max;
    this.rel = new Float32Array(o.max * 3); this.pos = new Float32Array(o.max * 3); this.phase = new Float32Array(o.max);
    const col = new Float32Array(o.max * 3);
    const c = new THREE.Color();
    for (let i = 0; i < o.max; i++) {
      for (let k = 0; k < 3; k++) this.rel[i * 3 + k] = (Math.random() - 0.5) * 2 * o.box;
      this.phase[i] = Math.random() * 6.283;
      c.setHex(o.colors[Math.floor(Math.random() * o.colors.length)]);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.mat = new THREE.PointsMaterial({
      size: o.size, map: tex, vertexColors: true, transparent: true, opacity: o.opacity, depthWrite: false, sizeAttenuation: true,
      blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    });
    this.vel = o.vel.clone();
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false; this.points.visible = false;
    scene.add(this.points);
  }

  update(dt: number, cam: THREE.Vector3, pv: { x: number; y: number; z: number }, intensity: number, tint?: number) {
    this.t += dt;
    const n = Math.floor(this.limit * clamp(intensity, 0, 1));
    this.points.visible = n > 1;
    if (!this.points.visible) return;
    this.mat.opacity = this.o.opacity * Math.min(1, intensity * 2);
    if (tint !== undefined) this.mat.color.setScalar(tint);
    const b = this.o.box, B = 2 * b, sw = this.o.sway || 0, fl = this.o.flutter || 0;
    const r = this.rel, p = this.pos, ph = this.phase;
    const rvx = this.vel.x - pv.x, rvy = this.vel.y - pv.y, rvz = this.vel.z - pv.z;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      let x = r[j] + rvx * dt, y = r[j + 1] + rvy * dt, z = r[j + 2] + rvz * dt;
      if (sw) { x += Math.sin(this.t * 1.3 + ph[i]) * sw * dt; z += Math.cos(this.t * 1.1 + ph[i] * 1.7) * sw * dt; }
      if (fl) { x += Math.sin(this.t * 3 + ph[i]) * fl * dt; y += Math.cos(this.t * 4 + ph[i] * 1.7) * fl * 0.7 * dt; z += Math.sin(this.t * 2.3 + ph[i] * 2.1) * fl * dt; }
      x = ((x + b) % B + B) % B - b; y = ((y + b) % B + B) % B - b; z = ((z + b) % B + B) % B - b;
      r[j] = x; r[j + 1] = y; r[j + 2] = z;
      p[j] = cam.x + x; p[j + 1] = cam.y + y; p[j + 2] = cam.z + z;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
  }
}

export interface AtmoCtx {
  cam: THREE.Vector3; pv: { x: number; y: number; z: number }; wind: { x: number; z: number };
  rain: number; snow: number; storm: number; speed01: number; altitude: number;
  green: number; dark: number; dayF: number; level: number; light: number;
}

/** All precipitation, ambient particles and speed streaks. */
export class AtmosphereFX {
  rain: RainField; lines: RainField;
  snow: ParticleField; leaves: ParticleField; debris: ParticleField; butterflies: ParticleField;

  constructor(scene: THREE.Scene, tex: THREE.Texture) {
    this.rain = new RainField(scene, 3500, 70, 0xcfe0ff, 0.38, new THREE.Vector3(0, -16, 0), 0.03, 5);
    this.lines = new RainField(scene, 500, 35, 0xffffff, 0.22, new THREE.Vector3(0, 0, 0), 0.035, 7);
    this.snow = new ParticleField(scene, tex, { max: 3500, box: 70, size: 0.16, colors: [0xffffff, 0xe8f2ff], opacity: 0.9, vel: new THREE.Vector3(0, -2.4, 0), sway: 1.2 });
    this.leaves = new ParticleField(scene, tex, { max: 400, box: 60, size: 0.34, colors: [0x6a8f2a, 0x9a7a2a, 0x4f7a2a, 0xb06a28], opacity: 0.95, vel: new THREE.Vector3(0, -0.8, 0), sway: 3, flutter: 2 });
    this.debris = new ParticleField(scene, tex, { max: 500, box: 60, size: 0.28, colors: [0x6b625a, 0x4a4540, 0x8a8076], opacity: 0.85, vel: new THREE.Vector3(0, -1, 0), sway: 2, flutter: 3 });
    this.butterflies = new ParticleField(scene, tex, { max: 150, box: 50, size: 0.45, colors: [0xffb347, 0xffe066, 0xff7aa8, 0x8ad4ff], opacity: 1, vel: new THREE.Vector3(0, 0, 0), sway: 1, flutter: 5 });
  }

  setLimits(rain: number, snow: number, leaves: number, lines: number) {
    this.rain.setMax(rain); this.snow.limit = snow; this.leaves.limit = leaves; this.lines.setMax(lines);
  }

  update(dt: number, c: AtmoCtx) {
    const wx = c.wind.x, wz = c.wind.z;
    this.rain.fall.set(wx * 0.3, -16 - c.storm * 6, wz * 0.3);
    this.rain.update(dt, c.cam, c.pv, c.rain);
    this.snow.vel.set(wx * 0.5, -2.4, wz * 0.5);
    this.snow.update(dt, c.cam, c.pv, c.snow, 0.35 + 0.65 * c.light);
    this.lines.update(dt, c.cam, c.pv, clamp((c.speed01 - 0.3) / 0.55, 0, 1));
    this.leaves.vel.set(wx * 0.8, -0.6, wz * 0.8);
    const leafI = c.altitude < 500 ? clamp(c.green, 0, 1) * 0.5 : 0;
    this.leaves.update(dt, c.cam, c.pv, leafI, 0.3 + 0.7 * c.light);
    this.debris.vel.set(wx * 1.2, -0.4, wz * 1.2);
    this.debris.update(dt, c.cam, c.pv, c.dark > 0.25 ? 0.55 : 0, 0.3 + 0.7 * c.light);
    const bf = c.altitude < 160 && c.green > 0.5 && c.dayF > 0.5 ? 0.5 : 0;
    this.butterflies.update(dt, c.cam, c.pv, bf, 0.5 + 0.5 * c.light);
  }
}
