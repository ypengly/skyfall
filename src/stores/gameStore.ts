import { create } from 'zustand';
import type { GameMode, HudData, RunResults, SaveData, Screen, Settings } from '../types';
import { SaveManager } from '../game/systems/SaveManager';

export const EMPTY_HUD: HudData = {
  speed: 0, altitude: 0, levelNo: 1, levelName: '', envName: '', weather: 'Clear', clock: '06:36', todLabel: 'Sunrise',
  distance: 0, progress: 0, cpIndex: 0, cpTotal: 9, flight: 'standing', fps: 60, timer: 0, boost: 1,
  score: 0, crashes: 0, objective: '', mode: 'adventure', depth: 0, windWarn: '',
};

export interface Toast { id: number; text: string; kind: 'info' | 'good' | 'bad' }
export interface LevelCard { id: number; title: string; sub: string }

interface UIState {
  screen: Screen;
  returnScreen: Screen;
  loading: { progress: number; label: string };
  settings: Settings;
  hud: HudData;
  results: RunResults | null;
  save: SaveData;
  mode: GameMode;
  toast: Toast | null;
  levelCard: LevelCard | null;
  explore: { weather: string; time: number | null };
  setScreen: (s: Screen) => void;
  openSettings: (from: Screen) => void;
  setLoading: (progress: number, label: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setHud: (h: HudData) => void;
  setResults: (r: RunResults | null) => void;
  refreshSave: () => void;
  setMode: (m: GameMode) => void;
  pushToast: (text: string, kind?: Toast['kind']) => void;
  showLevelCard: (c: LevelCard) => void;
  setExplore: (p: Partial<{ weather: string; time: number | null }>) => void;
}

let toastId = 1;

export const useGameStore = create<UIState>((set, get) => ({
  screen: 'loading',
  returnScreen: 'menu',
  loading: { progress: 0, label: 'Starting…' },
  settings: SaveManager.loadSettings(),
  hud: EMPTY_HUD,
  results: null,
  save: SaveManager.loadSave(),
  mode: 'adventure',
  toast: null,
  levelCard: null,
  explore: { weather: 'auto', time: null },
  setScreen: (screen) => set({ screen }),
  openSettings: (from) => set({ screen: 'settings', returnScreen: from }),
  setLoading: (progress, label) => set({ loading: { progress, label } }),
  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    SaveManager.saveSettings(settings);
    set({ settings });
  },
  setHud: (hud) => set({ hud }),
  setResults: (results) => set({ results }),
  refreshSave: () => set({ save: SaveManager.loadSave() }),
  setMode: (mode) => set({ mode }),
  pushToast: (text, kind = 'info') => set({ toast: { id: toastId++, text, kind } }),
  showLevelCard: (levelCard) => set({ levelCard }),
  setExplore: (p) => set({ explore: { ...get().explore, ...p } }),
}));
