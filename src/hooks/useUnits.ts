import { useGameStore } from '../stores/gameStore';

/** Speed/altitude formatting helpers honoring the units setting. */
export function useUnits() {
  const units = useGameStore((s) => s.settings.units);
  return {
    unit: units === 'mph' ? 'mph' : 'km/h',
    speed: (kmh: number) => Math.round(units === 'mph' ? kmh * 0.621371 : kmh),
    dist: (m: number) => (units === 'mph' ? `${(m / 1609.34).toFixed(2)} mi` : m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`),
    alt: (m: number) => (units === 'mph' ? `${Math.round(m * 3.28084)} ft` : `${Math.round(m)} m`),
  };
}
