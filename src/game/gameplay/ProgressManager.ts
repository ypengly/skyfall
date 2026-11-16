import { levels } from '../levels/LevelManager';
import { mountains, Z_MAX } from '../world/MountainGenerator';

/** Maps the player's position to stage, progress and distance-to-destination. */
export class ProgressManager {
  d = 0; levelIdx = 0; progress = 0; remaining = Z_MAX; changed = false;

  update(z: number) {
    this.d = -z;
    const i = levels.idx(this.d);
    this.changed = i !== this.levelIdx;
    this.levelIdx = i;
    this.progress = levels.progress(this.d);
    this.remaining = Math.max(0, Z_MAX - this.d);
    return this;
  }

  get level() { return levels.get(this.levelIdx); }
  get endless() { return mountains.endless; }
}
