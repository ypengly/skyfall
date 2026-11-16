import { makeLevel } from './LevelDef';
export const level09 = makeLevel(9, {
  name: 'The Last Mountain', subtitle: 'One final wall of ice and wind', env: 'E', envName: 'The Snow Kingdom',
  weather: { snow: 0.6, fog: 0.25, storm: 0.25, wind: 0.95, cloud: 0.8 }, biome: { snow: 0.85, dark: 0.15 },
  pillars: 8, boulders: 12, gaps: 2, snowCells: 2, turbs: 3, flocks: 0, eagles: 2, waterfalls: 2, parTime: 50,
  tip: 'The canyon narrows again. Hold your nerve — dawn is close.',
});
