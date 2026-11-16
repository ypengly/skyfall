import { makeLevel } from './LevelDef';
export const level04 = makeLevel(4, {
  name: 'The Green Valley', subtitle: 'Where the mist sleeps between the hills', env: 'C', envName: 'The Green Valley',
  weather: { fog: 0.55, wind: 0.2, cloud: 0.45 }, biome: { green: 1 },
  pillars: 8, boulders: 8, updrafts: 2, flocks: 5, eagles: 0, waterfalls: 4, parTime: 35,
  tip: 'Fog hides tall rock spires. Slow down with S when you cannot see.',
});
