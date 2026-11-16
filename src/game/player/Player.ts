import * as THREE from 'three';
import type { InputState, V3 } from '../../types';
import { PlayerAnimation } from './PlayerAnimation';
import { PlayerController } from './PlayerController';
import { PlayerPhysics, WindSample } from './PlayerPhysics';

export class Player {
  physics = new PlayerPhysics();
  animation = new PlayerAnimation();
  controller = new PlayerController(this.physics);

  constructor(scene: THREE.Scene) { scene.add(this.animation.root); }

  reset(pos: V3, vel: V3, yaw: number, standing: boolean) {
    this.physics.reset(pos, vel, yaw, standing);
    this.controller.reset();
    this.animation.update(0.5, this.physics);
  }

  /** Advances physics with sub-steps; returns true if the player just jumped. */
  update(dt: number, inp: InputState, wind: WindSample, frozen = false): boolean {
    const { ctl, jumped } = this.controller.compute(inp);
    if (!frozen) {
      let rem = dt;
      while (rem > 1e-5) {
        const h = Math.min(rem, 1 / 90);
        this.physics.step(h, ctl, wind);
        ctl.mouseYaw = 0;
        rem -= h;
      }
    }
    this.animation.update(dt, this.physics);
    return jumped;
  }
}
