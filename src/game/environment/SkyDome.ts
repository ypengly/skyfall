import * as THREE from 'three';
import type { WeatherState } from '../../types';
import { clamp, lerp } from '../../utils/math';
import type { SkyState } from './DayNightCycle';
import { shared } from './shared';

const VS = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w;
}`;

const FS = /* glsl */ `
uniform vec3 uTop, uHorizon, uSunDir, uMoonDir, uSunColor;
uniform float uStars, uTime, uGreyAmt, uFlash;
varying vec3 vDir;
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec3 d = normalize(vDir);
  float t = pow(clamp(d.y, 0.0, 1.0), 0.5);
  vec3 col = mix(uHorizon, uTop, t);
  col = mix(col, uHorizon * 0.75, 1.0 - smoothstep(-0.25, 0.0, d.y));
  float sd = max(dot(d, uSunDir), 0.0);
  vec3 glow = uSunColor * (pow(sd, 6.0) * 0.25 + pow(sd, 64.0) * 0.35 + pow(sd, 1200.0) * 3.0);
  col += glow * (1.0 - uGreyAmt * 0.85);
  float md = dot(d, uMoonDir);
  float clear = 1.0 - uGreyAmt;
  col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9994, 0.9997, md) * uStars * clear;
  col += vec3(0.4, 0.5, 0.8) * pow(max(md, 0.0), 48.0) * 0.12 * uStars * clear;
  vec3 sp = floor(d * 180.0);
  float r = hash3(sp);
  float st = step(0.9975, r) * (0.55 + 0.45 * sin(uTime * 1.5 + r * 50.0));
  col += vec3(st) * uStars * smoothstep(0.02, 0.3, d.y) * clear;
  col += vec3(0.85, 0.9, 1.0) * uFlash * 0.6;
  gl_FragColor = vec4(col, 1.0);
}`;

export class SkyDome {
  mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private grey = new THREE.Color();
  private storm = new THREE.Color();
  overcast = 0;

  constructor(scene: THREE.Scene) {
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: shared.uTop, uHorizon: shared.uHorizon, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uTime: shared.uTime,
        uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uStars: { value: 0 }, uGreyAmt: { value: 0 }, uFlash: { value: 0 },
      },
      vertexShader: VS, fragmentShader: FS, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);
  }

  follow(p: THREE.Vector3) { this.mesh.position.copy(p); }

  update(st: SkyState, ws: WeatherState, flash: number, time: number) {
    const over = clamp(Math.max(ws.storm, ws.rain * 0.85, ws.snow * 0.75, ws.cloud * 0.55), 0, 1);
    this.overcast = over;
    const lum = 0.25 + 0.75 * st.dayF;
    this.grey.setRGB(0.55 * lum, 0.58 * lum, 0.63 * lum);
    this.storm.setRGB(0.15 * lum + 0.01, 0.17 * lum + 0.01, 0.21 * lum + 0.015);
    this.grey.lerp(this.storm, ws.storm);
    shared.uTop.value.copy(st.top).lerp(this.grey, over * 0.8);
    shared.uHorizon.value.copy(st.horizon).lerp(this.grey, over * 0.7);
    shared.uSunDir.value.copy(st.sunDir);
    shared.uSunColor.value.copy(st.sunColor);
    shared.uTime.value = time;
    shared.uLight.value = lerp(0.12, 1, st.dayF) * (1 - 0.45 * over);
    const u = this.mat.uniforms;
    u.uMoonDir.value.copy(st.moonDir);
    u.uStars.value = st.stars;
    u.uGreyAmt.value = over;
    u.uFlash.value = flash;
  }
}
