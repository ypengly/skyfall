import { makeLevel } from './LevelDef';
export const level06 = makeLevel(6, {
  name: 'Storm Above the Mountains', subtitle: 'The sky tears open', env: 'D', envName: 'The Dark Canyon',
  weather: { rain: 1, storm: 1, fog: 0.3, wind: 1, cloud: 1 }, biome: { snow: 0.1, green: 0.3, dark: 0.3 },
  pillars: 6, boulders: 8, turbs: 4, lightning: true, flocks: 0, eagles: 0, waterfalls: 3, parTime: 45,
  tip: 'Lightning strikes are telegraphed by a glowing line. Stay clear of it.',
});
