import * as THREE from 'three';
import type { QualityPreset } from '../systems/PerformanceManager';
import type { AssetManager } from '../systems/AssetManager';
import { Terrain } from './Terrain';
import { River } from './River';
import { WaterfallField } from './Waterfall';
import { Forest } from './Forest';
import { Clouds } from './Clouds';
import { Wildlife } from './Wildlife';
import { mountains } from './MountainGenerator';

/** Aggregates all static and ambient world content. */
export class World {
  group = new THREE.Group();
  terrain: Terrain; river: River; waterfalls: WaterfallField; forest: Forest; clouds: Clouds; wildlife: Wildlife;
  private builtEndless: boolean | null = null;

  constructor(private scene: THREE.Scene, assets: AssetManager, preset: QualityPreset) {
    scene.add(this.group);
    this.terrain = new Terrain(scene, preset);
    this.river = new River(this.group);
    this.waterfalls = new WaterfallField(scene, assets.textures.mist);
    this.forest = new Forest(scene, preset.trees);
    this.clouds = new Clouds(scene, assets.textures.cloud);
    this.wildlife = new Wildlife(scene);
    this.setQuality(preset);
  }

  setQuality(p: QualityPreset) {
    this.terrain.setQuality(p);
    this.forest.setMax(p.trees);
    this.clouds.setCount(p.clouds);
    this.wildlife.build(p.flockScale);
  }

  /** (Re)build everything derived from the terrain function when the mode (endless/normal) changes. */
  build(force = false) {
    if (!force && this.builtEndless === mountains.endless) return;
    this.builtEndless = mountains.endless;
    this.river.build();
    this.waterfalls.build();
  }

  update(dt: number, p: THREE.Vector3, ground: number, forceTerrain = false) {
    this.terrain.update(p.x, p.z, forceTerrain);
    this.forest.update(p.x, p.y, p.z, ground, forceTerrain || this.terrain.rebuiltNear);
    this.wildlife.update(dt, p);
  }
}
