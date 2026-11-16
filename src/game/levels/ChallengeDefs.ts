import type { ChallengeDef } from '../../types';
import { LEVEL_LEN } from './LevelDef';

export const CHALLENGES: ChallengeDef[] = [
  { id: 1, name: 'Needle Threader', desc: 'Pass all 8 gates through the Narrow Canyon without crashing.',
    dStart: 4 * LEVEL_LEN, dEnd: 5 * LEVEL_LEN, gates: 8, maxCrashes: 0 },
  { id: 2, name: 'Speed Demon', desc: 'Cross the two mountain stages in under 75 s and reach 300 km/h.',
    dStart: 0, dEnd: 2 * LEVEL_LEN, gates: 0, maxTime: 75, minSpeedKmh: 300 },
  { id: 3, name: 'Storm Runner', desc: 'Survive the storm in under 70 s with at most one hit and no crash.',
    dStart: 5 * LEVEL_LEN, dEnd: 6 * LEVEL_LEN, gates: 0, maxTime: 70, maxHits: 1, maxCrashes: 0 },
  { id: 4, name: 'Close Shave', desc: 'Make 12 near misses (within 15 m of rock) across the waterfall and valley stages without crashing.',
    dStart: 2 * LEVEL_LEN, dEnd: 4 * LEVEL_LEN, gates: 0, minNearMiss: 12, maxCrashes: 0 },
  { id: 5, name: 'Feather Landing', desc: 'Descend the last mountain and touch down gently (under 14 m/s) with no hits.',
    dStart: 8 * LEVEL_LEN, dEnd: 10 * LEVEL_LEN, gates: 0, landing: true, maxSink: 14, maxHits: 0, maxCrashes: 0 },
];
