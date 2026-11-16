import { makeLevel } from './LevelDef';
export const level10 = makeLevel(10, {
  name: 'Paradise Below', subtitle: 'Golden light on a waking world', env: 'F', envName: 'The Final Paradise',
  weather: { fog: 0.1, wind: 0.15, cloud: 0.3 }, biome: { green: 1 },
  pillars: 3, boulders: 4, flocks: 6, eagles: 1, waterfalls: 6, parTime: 40,
  tip: 'Open the air brake (S) and land softly in the meadow beside the river.',
});
