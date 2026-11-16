import * as THREE from 'three';
import type { WeatherState } from '../../types';
import { damp, smoothstep } from '../../utils/math';
import { shared } from './shared';

export class FogSystem {
  fog: THREE.FogExp2;
  density = 0.00015;
  private col = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.fog = new THREE.FogExp2(0xa8c8f0, this.density);
    scene.fog = this.fog;
  }

  update(dt: number, ws: WeatherState, cloudInside: number, zoneFog: number, altitude: number, cloudTint: THREE.Color) {
    const target = 0.00014 + ws.fog * 0.0011 + ws.rain * 0.0003 + ws.snow * 0.0006 + ws.storm * 0.0004
      + cloudInside * 0.0045 + zoneFog * 0.001 + (1 - smoothstep(0, 600, altitude)) * 0.00005;
    this.density = damp(this.density, target, cloudInside > 0.05 ? 6 : 1.5, dt);
    this.col.copy(shared.uHorizon.value);
    if (cloudInside > 0.01) this.col.lerp(cloudTint, Math.min(1, cloudInside * 1.2));
    shared.uFogColor.value.copy(this.col);
    shared.uFogDensity.value = this.density;
    this.fog.density = this.density;
    this.fog.color.copy(this.col).convertSRGBToLinear();
  }
}
