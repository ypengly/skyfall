import { makeLevel } from './LevelDef';
export const level08 = makeLevel(8, {
  name: 'The Dark Descent', subtitle: 'Only the stars light the way', env: 'D', envName: 'The Dark Canyon',
  weather: { snow: 0.2, fog: 0.3, wind: 0.6, cloud: 0.7 }, biome: { snow: 0.3, dark: 0.7 },
  pillars: 5, boulders: 10, gaps: 3, caves: 1, falling: 10, tunnels: 2, flocks: 0, eagles: 0, waterfalls: 1, parTime: 50,
  tip: 'Follow the glowing rings. Visibility is poor — trust your speed indicator.',
});
