import * as THREE from 'three';
import type { WeatherState } from '../../types';
import { clamp } from '../../utils/math';
import type { SkyState } from './DayNightCycle';
import { shared } from './shared';

export class LightingSystem {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  moon: THREE.DirectionalLight;
  cloudTint = new THREE.Color(1, 1, 1);
  private white = new THREE.Color(1, 1, 1);

  constructor(scene: THREE.Scene) {
    this.hemi = new THREE.HemisphereLight(0xaad0ff, 0x3a3630, 1.4);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.moon = new THREE.DirectionalLight(0x8fa8ff, 0.4);
    this.sun.shadow.camera.left = -420; this.sun.shadow.camera.right = 420;
    this.sun.shadow.camera.top = 420; this.sun.shadow.camera.bottom = -420;
    this.sun.shadow.camera.near = 10; this.sun.shadow.camera.far = 3200;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 1.5;
    scene.add(this.hemi, this.sun, this.sun.target, this.moon, this.moon.target);
  }

  setShadows(on: boolean, mapSize: number) {
    this.sun.castShadow = on;
    if (on && this.sun.shadow.mapSize.x !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      this.sun.shadow.map?.dispose();
      (this.sun.shadow as any).map = null;
    }
  }

  update(st: SkyState, ws: WeatherState, flash: number, p: THREE.Vector3) {
    const over = clamp(Math.max(ws.storm, ws.rain * 0.85, ws.snow * 0.75, ws.cloud * 0.55), 0, 1);
    this.hemi.color.copy(shared.uTop.value).lerp(shared.uHorizon.value, 0.5);
    this.hemi.groundColor.setRGB(0.18, 0.17, 0.16).multiplyScalar(0.4 + 0.6 * st.dayF);
    this.hemi.intensity = (0.3 + 1.15 * st.dayF) * (1 - 0.12 * over) + flash * 2.5;
    this.sun.color.copy(st.sunColor);
    this.sun.intensity = 3.0 * st.dayF * (1 - 0.7 * over);
    this.sun.position.copy(p).addScaledVector(st.sunDir, 1500);
    this.sun.target.position.copy(p);
    this.moon.intensity = 0.55 * (1 - st.dayF) * clamp(st.moonDir.y * 3, 0, 1);
    this.moon.position.copy(p).addScaledVector(st.moonDir, 1500);
    this.moon.target.position.copy(p);
    this.cloudTint.copy(st.sunColor).lerp(this.white, 0.55).multiplyScalar(0.2 + 0.8 * st.dayF).multiplyScalar(1 - 0.5 * ws.storm);
    this.cloudTint.r += flash * 0.5; this.cloudTint.g += flash * 0.5; this.cloudTint.b += flash * 0.6;
  }
}
