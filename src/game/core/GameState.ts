import type { ChallengeDef, GameMode } from '../../types';

export type Status = 'menu' | 'playing' | 'paused' | 'results';

/** Mutable per-run state (not reactive; the HUD gets a throttled copy). */
export class GameState {
  status: Status = 'menu';
  mode: GameMode = 'adventure';
  started = false;       // jumped yet?
  time = 0;
  crashes = 0;
  hits = 0;
  nearMiss = 0;
  avoided = 0;
  gates = 0;
  gatesTotal = 0;
  maxSpeed = 0;
  distance = 0;
  cpIndex = 0;
  score = 0;
  depth = 0;
  loops = 0;
  levelIdx = -1;
  respawnTimer = 0;
  finished = false;
  challenge: ChallengeDef | null = null;
  lastPos = { x: 0, y: 0, z: 0 };
  resumeSave = false;

  reset(mode: GameMode) {
    this.mode = mode;
    this.started = false; this.time = 0; this.crashes = 0; this.hits = 0; this.nearMiss = 0; this.avoided = 0;
    this.gates = 0; this.gatesTotal = 0; this.maxSpeed = 0; this.distance = 0; this.cpIndex = 0; this.score = 0;
    this.depth = 0; this.loops = 0; this.levelIdx = -1; this.respawnTimer = 0; this.finished = false;
    this.challenge = null; this.resumeSave = false;
  }
}
