import { makeLevel } from './LevelDef';
export const level01 = makeLevel(1, {
  name: 'Mountain Awakening', subtitle: 'Step off the edge of the world', env: 'A', envName: 'The First Mountain',
  weather: { snow: 0.12, fog: 0.05, wind: 0.25, cloud: 0.25 }, biome: { snow: 0.9 },
  pillars: 4, boulders: 6, updrafts: 2, flocks: 3, eagles: 2, waterfalls: 4, parTime: 30,
  tip: 'Hold SPACE to glide and stay on the glowing path. W dives, S brakes.',
});
