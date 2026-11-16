export type GameMode = 'adventure' | 'endless' | 'timetrial' | 'exploration' | 'challenge';
export type Screen = 'loading' | 'menu' | 'modes' | 'settings' | 'howto' | 'playing' | 'paused' | 'results';
export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export type CameraMode = 'third' | 'first' | 'wide';
export type FlightMode = 'standing' | 'freefall' | 'dive' | 'glide' | 'brake' | 'landed' | 'crashed';

export interface V3 { x: number; y: number; z: number }

export interface Settings {
  master: number; music: number; sfx: number;
  quality: Quality; adaptive: boolean;
  mouseSens: number; invertY: boolean; mouseLook: boolean;
  camMode: CameraMode; fovEffects: boolean; shake: number; camLag: number;
  showFps: boolean; units: 'kmh' | 'mph';
}

export interface WeatherState { rain: number; snow: number; fog: number; storm: number; wind: number; cloud: number }
export type WeatherTarget = WeatherState;
export interface BiomeInfo { snow: number; green: number; dark: number }

export interface HudData {
  speed: number; altitude: number; levelNo: number; levelName: string; envName: string;
  weather: string; clock: string; todLabel: string; distance: number; progress: number;
  cpIndex: number; cpTotal: number; flight: string; fps: number; timer: number; boost: number;
  score: number; crashes: number; objective: string; mode: GameMode; depth: number; windWarn: string;
}

export interface RunResults {
  mode: GameMode; completed: boolean; reason: string;
  time: number; maxSpeed: number; distance: number;
  checkpoints: number; checkpointTotal: number; avoided: number; nearMiss: number;
  hits: number; crashes: number; rating: string; score: number;
  bestLabel: string; newRecord: boolean; depth: number;
  challenge?: { name: string; success: boolean; lines: string[] };
}

export interface AdventureSave {
  cp: number; time: number; crashes: number; hits: number; nearMiss: number;
  avoided: number; maxSpeed: number; distance: number; gates: number; score: number;
}

export interface SaveData {
  adventure: AdventureSave | null;
  best: {
    adventure?: { time: number; score: number; rating: string };
    timetrial?: { time: number };
    endless?: { depth: number };
    exploration?: { time: number };
  };
  challengesDone: number[];
  totalRuns: number;
}

export interface InputState {
  steer: number; dive: number; brake: number; boost: boolean;
  mouseYaw: number; mousePitch: number;
  jump: boolean; camera: boolean; pause: boolean;
}

export interface ChallengeDef {
  id: number; name: string; desc: string;
  dStart: number; dEnd: number; gates: number;
  maxTime?: number; minSpeedKmh?: number; maxHits?: number; maxCrashes?: number;
  minNearMiss?: number; landing?: boolean; maxSink?: number;
}
