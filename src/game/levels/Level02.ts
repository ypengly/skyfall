import { makeLevel } from './LevelDef';
export const level02 = makeLevel(2, {
  name: 'Above the Clouds', subtitle: 'The sky is a sea of white', env: 'A', envName: 'The First Mountain',
  weather: { snow: 0.05, fog: 0.25, wind: 0.5, cloud: 0.95 }, biome: { snow: 0.8 },
  pillars: 5, boulders: 8, updrafts: 3, turbs: 2, flocks: 2, eagles: 2, waterfalls: 2, parTime: 35,
  tip: 'Updraft columns lift you — ride them to regain height.',
});
