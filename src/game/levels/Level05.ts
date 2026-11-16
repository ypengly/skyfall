import { makeLevel } from './LevelDef';
export const level05 = makeLevel(5, {
  name: 'The Narrow Canyon', subtitle: 'Walls close in on both sides', env: 'D', envName: 'The Dark Canyon',
  weather: { fog: 0.12, wind: 0.65, cloud: 0.3 }, biome: { green: 0.1, dark: 0.35 },
  pillars: 5, boulders: 12, gaps: 3, caves: 1, falling: 8, tunnels: 2, flocks: 1, eagles: 0, waterfalls: 1, parTime: 45,
  tip: 'Wind tunnels shove you sideways. Falling rocks hit but do not kill; walls do.',
});
