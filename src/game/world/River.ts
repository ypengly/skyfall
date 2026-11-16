import * as THREE from 'three';
import { smoothstep } from '../../utils/math';
import { FOG_GLSL, NOISE_GLSL, shared } from '../environment/shared';
import { levels } from '../levels/LevelManager';
import { mountains, Z_MAX } from './MountainGenerator';

const VS = /* glsl */ `
attribute float aFrozen;
varying vec3 vWorld; varying vec2 vUv; varying float vFrozen;
void main(){ vUv = uv; vFrozen = aFrozen; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const FS = /* glsl */ `
uniform float uTime, uLight; uniform vec3 uSunDir, uSunColor, uTop, uHorizon;
varying vec3 vWorld; varying vec2 vUv; varying float vFrozen;
${FOG_GLSL}
${NOISE_GLSL}
void main(){
  vec3 V = cameraPosition - vWorld; float dist = length(V); V /= dist;
  vec2 q = vec2(vWorld.x * 0.04, vWorld.z * 0.04 + uTime * 0.5);
  float n1 = vnoise(q * 3.0), n2 = vnoise(q * 7.0 - uTime * 0.3);
  vec3 N = normalize(vec3((n1 - 0.5) * 0.5, 1.0, (n2 - 0.5) * 0.5));
  float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
  vec3 deep = vec3(0.02, 0.18, 0.32) * (0.3 + 0.7 * uLight);
  vec3 refl = mix(uHorizon, uTop, 0.55);
  vec3 col = mix(deep, refl, 0.2 + 0.7 * fres);
  vec3 R = reflect(-uSunDir, N);
  col += uSunColor * pow(max(dot(R, V), 0.0), 140.0) * 1.4 * uLight;
  float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  float foam = (1.0 - edge) * 0.8 + step(0.8, vnoise(q * 14.0)) * 0.12;
  col = mix(col, vec3(0.9, 0.95, 1.0) * (0.35 + 0.65 * uLight), clamp(foam, 0.0, 1.0));
  vec3 ice = mix(vec3(0.55, 0.75, 0.9), vec3(0.9, 0.96, 1.0), n1) * (0.3 + 0.7 * uLight);
  col = mix(col, ice, vFrozen);
  col = applyFog(col, dist);
  gl_FragColor = vec4(col, 0.93);
}`;

/** Ribbon river running down the valley floor (frozen in snowy stages). */
export class River {
  mesh: THREE.Mesh | null = null;
  constructor(private group: THREE.Group) {}

  build() {
    this.dispose();
    const step = 40, d0 = 2000, d1 = mountains.endless ? Z_MAX - 1 : Z_MAX + 600;
    const n = Math.floor((d1 - d0) / step) + 1;
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), fr = new Float32Array(n * 2);
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const d = d0 + i * step;
      const cx = mountains.pathX(d), w = mountains.riverWidth(d);
      const y = mountains.floorAt(d) - 3;
      const frozen = smoothstep(0.45, 0.75, levels.biomeAt(d).snow) * (mountains.endless ? 1 : 1);
      for (let s = 0; s < 2; s++) {
        const k = i * 2 + s;
        pos[k * 3] = cx + (s ? w / 2 : -w / 2); pos[k * 3 + 1] = y; pos[k * 3 + 2] = -d;
        uv[k * 2] = s; uv[k * 2 + 1] = d / 30; fr[k] = frozen;
      }
      if (i < n - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aFrozen', new THREE.BufferAttribute(fr, 1));
    g.setIndex(idx);
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime, uLight: shared.uLight, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uTop: shared.uTop, uHorizon: shared.uHorizon, uFogColor: shared.uFogColor, uFogDensity: shared.uFogDensity },
      vertexShader: VS, fragmentShader: FS, transparent: true, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  dispose() {
    if (!this.mesh) return;
    this.group.remove(this.mesh); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh = null;
  }
}
