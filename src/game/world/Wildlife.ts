import * as THREE from 'three';
import { mulberry32 } from '../../utils/math';
import { FOG_GLSL, shared } from '../environment/shared';
import { levels } from '../levels/LevelManager';
import { mountains } from './MountainGenerator';

const VS = /* glsl */ `
attribute float aPhase; uniform float uTime; varying float vShade; varying float vDist;
void main(){
  vec3 p = position;
  float flap = sin(uTime * 8.0 + aPhase * 6.2831);
  p.y += flap * abs(p.x) * 0.7;
  vShade = 0.5 + 0.5 * flap;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vDist = length(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const FS = /* glsl */ `
uniform float uLight; varying float vShade; varying float vDist;
${FOG_GLSL}
void main(){
  vec3 c = mix(vec3(0.07, 0.07, 0.09), vec3(0.38, 0.36, 0.34), vShade * 0.6) * (0.35 + 0.65 * uLight);
  gl_FragColor = vec4(applyFog(c, vDist), 1.0);
}`;

interface Bird { p: THREE.Vector3; v: THREE.Vector3; off: THREE.Vector3; phase: number }
interface Flock { anchor: THREE.Vector3; R: number; w: number; ph: number; eagle: boolean; birds: Bird[]; alarm: number }

/** Flocking birds and soaring eagles (instanced, flapping in the vertex shader). */
export class Wildlife {
  mesh: THREE.InstancedMesh;
  flocks: Flock[] = [];
  /** Flat array [x,y,z,r] of bird colliders (updated every frame). */
  pos = new Float32Array(600 * 4);
  count = 0;
  callEagle: ((x: number, y: number, z: number) => void) | null = null;
  private m = new THREE.Matrix4(); private tmp = new THREE.Vector3(); private zero = new THREE.Vector3(); private up = new THREE.Vector3(0, 1, 0);
  private t = 0; private eagleTimer = 6; private scale = 1;

  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -0.8, 0, 0, 0.6, -1.2, 0, 0.3, 1.2, 0, 0.3]), 3));
    g.setIndex([0, 2, 1, 0, 1, 3]);
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(600), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uLight: shared.uLight, uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity },
      vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(g, mat, 600);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    scene.add(this.mesh);
  }

  build(flockScale = 1) {
    this.flocks = []; this.scale = flockScale;
    const phases = (this.mesh.geometry.getAttribute('aPhase') as THREE.InstancedBufferAttribute);
    let bi = 0;
    for (const L of levels.levels) {
      const rng = mulberry32(300 + L.id);
      const nf = Math.max(0, Math.round(L.flocks * flockScale)), ne = L.eagles;
      for (let k = 0; k < nf + ne; k++) {
        const eagle = k >= nf;
        const d = L.dStart + rng() * 1400;
        const hw = mountains.halfWidth(d);
        const anchor = new THREE.Vector3(mountains.pathX(d) + (rng() - 0.5) * hw * 1.3, mountains.pathY(d) + (rng() - 0.5) * 240 + (eagle ? 140 : 0), -d);
        const n = eagle ? 1 : 7 + Math.floor(rng() * 6);
        if (bi + n > 600) break;
        const birds: Bird[] = [];
        for (let i = 0; i < n; i++) {
          phases.setX(bi++, rng());
          birds.push({ p: anchor.clone().add(new THREE.Vector3((rng() - 0.5) * 40, (rng() - 0.5) * 12, (rng() - 0.5) * 40)), v: new THREE.Vector3(0, 0, -10), off: new THREE.Vector3((rng() - 0.5) * 36, (rng() - 0.5) * 10, (rng() - 0.5) * 36), phase: rng() });
        }
        this.flocks.push({ anchor, R: eagle ? 260 + rng() * 140 : 110 + rng() * 120, w: (eagle ? 0.05 : 0.11) * (rng() < 0.5 ? -1 : 1), ph: rng() * 6.28, eagle, birds, alarm: 0 });
      }
    }
    phases.needsUpdate = true;
    this.count = bi;
    this.mesh.count = bi;
  }

  update(dt: number, player: THREE.Vector3) {
    this.t += dt;
    let n = 0, near: Flock | null = null;
    for (const f of this.flocks) {
      const near3 = Math.abs(f.anchor.z - player.z) < 3500;
      const sc = f.eagle ? 3.4 : 1;
      if (near3) {
        const a = f.ph + this.t * f.w;
        const cx = f.anchor.x + Math.cos(a) * f.R, cz = f.anchor.z + Math.sin(a) * f.R, cy = f.anchor.y + Math.sin(this.t * 0.3 + f.ph) * 14;
        const pd = Math.hypot(player.x - cx, player.y - cy, player.z - cz);
        if (pd < 150 && !f.eagle) f.alarm = 3;
        if (f.eagle && pd < 700) near = f;
        f.alarm = Math.max(0, f.alarm - dt);
        const cruise = f.eagle ? 20 : 15;
        for (const b of f.birds) {
          this.tmp.set(cx + b.off.x, cy + b.off.y, cz + b.off.z).sub(b.p);
          b.v.addScaledVector(this.tmp, 0.9 * dt);
          if (f.alarm > 0) {
            this.tmp.copy(b.p).sub(player); const l = this.tmp.length() || 1;
            b.v.addScaledVector(this.tmp, (60 / l) * dt * 4); b.v.y += 6 * dt;
          }
          const sp = b.v.length(), maxS = f.alarm > 0 ? cruise * 2.2 : cruise * 1.3;
          if (sp > maxS) b.v.multiplyScalar(maxS / sp);
          if (sp < cruise * 0.5 && f.alarm <= 0) b.v.multiplyScalar(1.02);
          b.p.addScaledVector(b.v, dt);
        }
      }
      for (const b of f.birds) {
        if (b.v.lengthSq() < 0.01) b.v.set(0, 0, -1);
        this.m.lookAt(this.zero, b.v, this.up);
        this.m.scale(this.tmp.set(sc, sc, sc));
        this.m.setPosition(b.p);
        this.mesh.setMatrixAt(n, this.m);
        const o = n * 4; this.pos[o] = b.p.x; this.pos[o + 1] = b.p.y; this.pos[o + 2] = b.p.z; this.pos[o + 3] = f.eagle ? 5 : 2.4;
        n++;
      }
    }
    this.count = n; this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.eagleTimer -= dt;
    if (near && this.eagleTimer <= 0) { this.eagleTimer = 7 + Math.random() * 9; this.callEagle?.(near.birds[0].p.x, near.birds[0].p.y, near.birds[0].p.z); }
  }
}
