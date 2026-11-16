
import type { FlightMode, InputState } from '../../types';
import type { PhysInput, PlayerPhysics } from './PlayerPhysics';

/**
 * Player Controller
 * Provides stable, forgiving flight controls.
 * Designed to reduce accidental falls and improve recovery.
 */
export class PlayerController {
  glide = true;

  private jumpLocked = false;
  private lastMode: FlightMode = 'freefall';

  constructor(private phys: PlayerPhysics) {}

  reset() {
    this.glide = true;
    this.jumpLocked = false;
    this.lastMode = 'freefall';
  }

  compute(inp: InputState): { ctl: PhysInput; jumped: boolean } {
    const p = this.phys;
    let jumped = false;

    // --------------------------------
    // 1. Jump protection
    // --------------------------------
    if (!inp.jump) {
      this.jumpLocked = false;
    }

    if (inp.jump && !this.jumpLocked) {
      if (p.mode === 'standing') {
        p.jump();
        this.glide = true;
        jumped = true;
        this.jumpLocked = true;
      } else if (p.flying) {
        // Toggle glide only while flying
        this.glide = !this.glide;
        this.jumpLocked = true;
      }
    }

    // --------------------------------
    // 2. Smart flight mode selection
    // --------------------------------
    if (p.flying) {
      let mode: FlightMode = 'glide';

      // Brake has highest priority
      if (inp.brake > 0.3) {
        mode = 'brake';
      }

      // Dive requires intentional input
      else if (inp.dive > 0.65) {
        mode = 'dive';
      }

      // Glide is the safe default
      else if (this.glide) {
        mode = 'glide';
      }

      // Freefall only when explicitly disabled
      else {
        mode = 'freefall';
      }

      p.setMode(mode);
      this.lastMode = mode;
    }

    // --------------------------------
    // 3. Flight input stabilization
    // --------------------------------
    const ctl: PhysInput = {
      steer: inp.steer,
      dive: inp.dive,
      brake: inp.brake,
      boost: inp.boost,
      glide: this.glide,
      mouseYaw: inp.mouseYaw
    };

    return { ctl, jumped };
  }

  // --------------------------------
  // 4. Emergency recovery
  // --------------------------------
  recover() {
    if (this.phys.flying) {
      this.glide = true;
      this.phys.setMode('glide');
      this.lastMode = 'glide';
    }
  }
}
