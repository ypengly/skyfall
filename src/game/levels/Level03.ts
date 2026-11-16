import { makeLevel } from './LevelDef';
export const level03 = makeLevel(3, {
  name: 'Waterfall Paradise', subtitle: 'Thunder of a hundred cascades', env: 'B', envName: 'Waterfall Paradise',
  weather: { fog: 0.18, wind: 0.25, cloud: 0.35 }, biome: { green: 0.75 },
  pillars: 6, boulders: 8, updrafts: 2, flocks: 4, eagles: 1, waterfalls: 9, parTime: 35,
  tip: 'Fly close to the waterfalls — the roar and mist are worth the risk.',
});
