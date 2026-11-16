import { makeLevel } from './LevelDef';
export const level07 = makeLevel(7, {
  name: 'Frozen Kingdom', subtitle: 'Ice, silence and blue light', env: 'E', envName: 'The Snow Kingdom',
  weather: { snow: 1, fog: 0.35, wind: 0.8, cloud: 0.85 }, biome: { snow: 1, dark: 0.1 },
  pillars: 6, boulders: 8, caves: 1, snowCells: 3, frozen: true, flocks: 0, eagles: 1, waterfalls: 4, parTime: 45,
  tip: 'Snowstorm cells reduce visibility and buffet you. Ice caves are a shortcut.',
});
