import * as THREE from 'three';
import { mulberry32 } from '../../utils/math';
import { FOG_GLSL, NOISE_GLSL, shared } from '../environment/shared';
import { levels } from '../levels/LevelManager';
import { mountains } from './MountainGenerator';

const VS = /* glsl */ `
varying vec3 vWorld; varying vec2 vUv;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = /* glsl */ `
uniform float uTime, uLight, uFrozen;
varying vec3 vWorld; varying vec2 vUv;
${FOG_GLSL}
${NOISE_GLSL}
void main(){
  float speed = mix(2.8, 0.05, uFrozen);
  float s = vnoise(vec2(vUv.x * 9.0, vUv.y * 2.2 - uTime * speed)) * 0.6 + vnoise(vec2(vUv.x * 22.0, vUv.y * 5.0 - uTime * speed * 1.7)) * 0.4;
  vec3 water = mix(vec3(0.55, 0.75, 0.95), vec3(1.0), s);
  vec3 ice = mix(vec3(0.5, 0.72, 0.9), vec3(0.85, 0.95, 1.0), s);
  vec3 col = mix(water, ice, uFrozen) * (0.25 + 0.75 * uLight);
  float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
  float a = edge * (0.55 + 0.4 * s);
  col = applyFog(col, length(cameraPosition - vWorld));
  gl_FragColor = vec4(col, a);
}`;

const RB_VS = /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RB_FS = /* glsl */ `
uniform float uAlpha, uR0, uR1; varying vec2 vP;
vec3 ramp(float t){ vec3 c = vec3(0.0); c += vec3(1.0,0.1,0.1) * smoothstep(0.0,0.17,t) * (1.0-smoothstep(0.17,0.34,t));
  c += vec3(1.0,0.6,0.1) * smoothstep(0.1,0.27,t) * (1.0-smoothstep(0.27,0.44,t)); c += vec3(1.0,1.0,0.2) * smoothstep(0.25,0.4,t) * (1.0-smoothstep(0.4,0.55,t));
  c += vec3(0.2,1.0,0.3) * smoothstep(0.4,0.55,t) * (1.0-smoothstep(0.55,0.7,t)); c += vec3(0.2,0.5,1.0) * smoothstep(0.55,0.72,t) * (1.0-smoothstep(0.72,0.86,t));
  c += vec3(0.6,0.2,0.9) * smoothstep(0.7,0.9,t); return c; }
void main(){ float r = length(vP); float t = (r - uR0) / (uR1 - uR0); gl_FragColor = vec4(ramp(clamp(t,0.0,1.0)), uAlpha * smoothstep(0.0,0.15,t) * (1.0 - smoothstep(0.85,1.0,t))); }`;

export interface FallInfo { x: number; y: number; z: number }

/** Ribbons draped down the canyon walls with animated water, mist and rainbows. */
export class WaterfallField {
  group = new THREE.Group();
  positions: FallInfo[] = [];
  private mats: THREE.ShaderMaterial[] = [];
  private mist: { s: THREE.Sprite; base: number; ph: number }[] = [];
  private rainbows: { m: THREE.Mesh; mat: THREE.ShaderMaterial }[] = [];

  constructor(scene: THREE.Scene, private mistTex: THREE.Texture) { scene.add(this.group); }

  build() {
    this.dispose();
    for (const L of levels.levels) {
      const rng = mulberry32(900 + L.id);
      for (let k = 0; k < L.waterfalls; k++) {
        const d = L.dStart + ((k + 0.5) / L.waterfalls) * 1400 + (rng() - 0.5) * 80;
        const side = rng() < 0.5 ? -1 : 1;
        this.addFall(d, side, 16 + rng() * 26, L.frozen, rng, L.id === 3 || L.id === 10 || L.id === 1);
      }
    }
  }

  private addFall(d: number, side: number, width: number, frozen: boolean, rng: () => number, rainbow: boolean) {
    const z = -d;
    const hw = mountains.halfWidth(d), cx = mountains.pathX(d);
    const x0 = cx + side * (hw + 560);
    const pts: THREE.Vector3[] = [];
    let lastY = 1e9;
    for (let j = 0; j < 46; j++) {
      const x = x0 - side * j * 18 + Math.sin(j * 0.6 + d) * 4;
      if (Math.abs(x - cx) < hw * 0.55) break;
      let y = mountains.heightAt(x, z) + 4;
      y = Math.min(y, lastY - 0.2); lastY = y;
      pts.push(new THREE.Vector3(x, y, z));
    }
    if (pts.length < 4) return;
    const n = pts.length;
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx: number[] = [];
    let len = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) len += pts[i].distanceTo(pts[i - 1]);
      const w = width * (0.6 + 0.4 * (i / n));
      for (let s = 0; s < 2; s++) {
        const k = i * 2 + s;
        pos[k * 3] = pts[i].x; pos[k * 3 + 1] = pts[i].y; pos[k * 3 + 2] = pts[i].z + (s ? w / 2 : -w / 2);
        uv[k * 2] = s; uv[k * 2 + 1] = len / 40;
      }
      if (i < n - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uLight: shared.uLight, uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity, uFrozen: { value: frozen ? 1 : 0 } },
      vertexShader: VS, fragmentShader: FS, transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    this.mats.push(mat);
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false;
    this.group.add(mesh);
    const base = pts[n - 1];
    this.positions.push({ x: base.x, y: base.y, z: base.z });
    if (!frozen) {
      for (let m = 0; m < 3; m++) {
        const sm = new THREE.SpriteMaterial({ map: this.mistTex, transparent: true, opacity: 0.5, depthWrite: false, color: 0xffffff });
        const s = new THREE.Sprite(sm);
        const sc = 70 + rng() * 60;
        s.scale.set(sc, sc * 0.7, 1);
        s.position.set(base.x - side * (m * 14), base.y + 14 + m * 8, base.z + (rng() - 0.5) * 20);
        this.group.add(s);
        this.mist.push({ s, base: sc, ph: rng() * 6 });
      }
    }
    if (rainbow && !frozen) {
      const mat2 = new THREE.ShaderMaterial({
        uniforms: { uAlpha: { value: 0 }, uR0: { value: 150 }, uR1: { value: 190 } },
        vertexShader: RB_VS, fragmentShader: RB_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(150, 190, 48, 1, 0, Math.PI), mat2);
      ring.position.set(base.x - side * 40, base.y + 10, base.z);
      ring.rotation.y = Math.PI / 2;   // arc plane runs along the corridor axis
      ring.frustumCulled = false;
      this.group.add(ring);
      this.rainbows.push({ m: ring, mat: mat2 });
    }
  }

  update(t: number, sunY: number, dayF: number, clear: number) {
    for (const m of this.mist) { const k = 1 + 0.12 * Math.sin(t * 0.8 + m.ph); m.s.scale.set(m.base * k, m.base * 0.7 * k, 1); (m.s.material as THREE.SpriteMaterial).opacity = 0.18 + 0.2 * dayF; }
    const rb = Math.max(0, Math.min(1, (sunY - 0.05) * 4)) * Math.max(0, 1 - sunY * 1.6) * clear * dayF;
    for (const r of this.rainbows) r.mat.uniforms.uAlpha.value = rb * 0.45;
  }

  /** Nearest waterfall distance to a point. */
  nearest(x: number, y: number, z: number) {
    let best = 1e9, bx = 0, bz = 0;
    for (const p of this.positions) {
      if (Math.abs(p.z - z) > 900) continue;
      const d = Math.hypot(p.x - x, p.y - y, p.z - z);
      if (d < best) { best = d; bx = p.x; bz = p.z; }
    }
    return { dist: best, x: bx, z: bz };
  }

  dispose() {
    this.group.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose && !(o instanceof THREE.Sprite)) o.material.dispose(); if (o instanceof THREE.Sprite) o.material.dispose(); });
    this.group.clear();
    this.positions = []; this.mats = []; this.mist = []; this.rainbows = [];
  }
}
