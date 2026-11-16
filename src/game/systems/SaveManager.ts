import type { SaveData, Settings } from '../../types';

const SAVE_KEY = 'skyfall.save.v1';
const SETTINGS_KEY = 'skyfall.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8, music: 0.5, sfx: 0.8,
  quality: 'high', adaptive: true,
  mouseSens: 1, invertY: false, mouseLook: true,
  camMode: 'third', fovEffects: true, shake: 0.6, camLag: 1,
  showFps: false, units: 'kmh',
};

export const DEFAULT_SAVE: SaveData = { adventure: null, best: {}, challengesDone: [], totalRuns: 0 };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export const SaveManager = {
  loadSettings(): Settings { return read(SETTINGS_KEY, DEFAULT_SETTINGS); },
  saveSettings(s: Settings) { write(SETTINGS_KEY, s); },
  loadSave(): SaveData { const d = read<SaveData>(SAVE_KEY, DEFAULT_SAVE); d.best = d.best || {}; d.challengesDone = d.challengesDone || []; return d; },
  writeSave(d: SaveData) { write(SAVE_KEY, d); },
  update(fn: (d: SaveData) => void): SaveData { const d = this.loadSave(); fn(d); this.writeSave(d); return d; },
  clearAll() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } },
};
