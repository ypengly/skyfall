import { clamp } from '../../utils/math';

export interface EnvAudioState {
  speed01: number; turb: number; rain: number; snow: number; storm: number; wind: number;
  waterDist: number; waterPan: number; riverNear: number; inCave: boolean; altitude: number;
  green: number; dayF: number; paused: boolean; active: boolean;
}

function noiseBuffer(ctx: AudioContext, seconds: number, kind: 'white' | 'pink' | 'brown') {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2; }
    else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  return buf;
}

export function makeImpulse(ctx: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

interface Layer { gain: GainNode; filter: BiquadFilterNode }

/** Looping environmental layers (wind, rain, water…) + procedural bird/eagle calls, all driven by game state. */
export class EnvironmentAudio {
  private windLow!: Layer; private windHigh!: Layer; private rain!: Layer; private snowWind!: Layer;
  private water!: Layer; private river!: Layer; private leaves!: Layer; private pan!: StereoPannerNode;
  private bus: GainNode; private dry: GainNode; private wet: GainNode; private conv: ConvolverNode;
  private lfo!: OscillatorNode;
  private birdTimer = 2; private eagleTimer = 8;

  constructor(private ctx: AudioContext, out: AudioNode) {
    this.bus = ctx.createGain();
    this.dry = ctx.createGain(); this.wet = ctx.createGain(); this.conv = ctx.createConvolver();
    this.conv.buffer = makeImpulse(ctx, 2.6, 2.2);
    this.wet.gain.value = 0.0; this.dry.gain.value = 1;
    this.bus.connect(this.dry); this.bus.connect(this.conv); this.conv.connect(this.wet);
    this.dry.connect(out); this.wet.connect(out);

    const white = noiseBuffer(ctx, 3, 'white'), pink = noiseBuffer(ctx, 4, 'pink'), brown = noiseBuffer(ctx, 4, 'brown');
    const mk = (buf: AudioBuffer, type: BiquadFilterType, freq: number, q = 0.7, dest: AudioNode = this.bus): Layer => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      src.loopStart = Math.random() * 0.5;
      const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter); filter.connect(gain); gain.connect(dest); src.start();
      return { gain, filter };
    };
    this.windLow = mk(brown, 'lowpass', 400);
    this.windHigh = mk(pink, 'bandpass', 900, 0.8);
    this.rain = mk(white, 'highpass', 3500);
    this.snowWind = mk(pink, 'bandpass', 700, 3);
    this.leaves = mk(white, 'highpass', 5000);
    this.pan = ctx.createStereoPanner();
    this.pan.connect(this.bus);
    this.water = mk(brown, 'lowpass', 900, 0.7, this.pan);
    this.river = mk(pink, 'bandpass', 1400, 0.6, this.pan);
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 0.18;
    const lg = ctx.createGain(); lg.gain.value = 250;
    this.lfo.connect(lg); lg.connect(this.snowWind.filter.frequency); this.lfo.start();
  }

  private set(g: GainNode, v: number, tc = 0.2) { g.gain.setTargetAtTime(v, this.ctx.currentTime, tc); }

  update(dt: number, s: EnvAudioState) {
    const ctx = this.ctx, t = ctx.currentTime;
    const live = s.active ? 1 : 0.35;
    const sp = s.speed01;
    this.set(this.windLow.gain, (0.04 + 0.5 * sp + 0.25 * s.wind) * live);
    this.windLow.filter.frequency.setTargetAtTime(250 + sp * 900, t, 0.3);
    this.set(this.windHigh.gain, (0.01 + 0.3 * sp * sp + 0.15 * s.turb) * live);
    this.windHigh.filter.frequency.setTargetAtTime(600 + sp * 2600, t, 0.3);
    this.set(this.rain.gain, 0.22 * s.rain * live);
    this.set(this.snowWind.gain, 0.3 * s.snow * (0.4 + s.wind) * live);
    const wd = clamp(1 - s.waterDist / 650, 0, 1);
    this.set(this.water.gain, 0.85 * wd * wd * live);
    this.set(this.river.gain, (0.3 * wd * wd + 0.14 * s.riverNear) * live);
    this.pan.pan.setTargetAtTime(clamp(s.waterPan, -1, 1), t, 0.2);
    const lf = s.altitude < 200 ? s.green * (0.04 + 0.05 * s.wind) : 0;
    this.set(this.leaves.gain, lf * live);
    this.wet.gain.setTargetAtTime(s.inCave ? 0.9 : 0.12, t, 0.15);
    this.dry.gain.setTargetAtTime(s.inCave ? 0.55 : 1, t, 0.15);
    this.windHigh.filter.Q.value = s.inCave ? 2.5 : 0.8;

    if (!s.active || s.paused) return;
    // bird song
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 0.8 + Math.random() * 3.5;
      const habitat = clamp(0.25 + s.green * 0.9, 0, 1) * (s.altitude < 1500 ? 1 : 0.4) * s.dayF * (1 - s.rain) * (1 - s.storm);
      if (Math.random() < habitat * 0.8) this.chirp(0.04 + 0.05 * habitat);
    }
  }

  private chirp(vol: number) {
    const ctx = this.ctx, t = ctx.currentTime;
    const n = 2 + Math.floor(Math.random() * 3), base = 2200 + Math.random() * 2200;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const g = ctx.createGain(); const st = t + i * 0.11;
      o.frequency.setValueAtTime(base * (1 + Math.random() * 0.3), st);
      o.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.8), st + 0.09);
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(vol, st + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.1);
      o.connect(g); g.connect(this.bus); o.start(st); o.stop(st + 0.12);
    }
  }

  eagle(vol = 0.1) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 3;
    const g = ctx.createGain();
    o.frequency.setValueAtTime(2900, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.9);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    o.connect(f); f.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 1.05);
  }

  /** One-shot filtered-noise burst routed through the env bus (thunder, rockfall). */
  burst(kind: 'thunder' | 'rock', vol: number, delay = 0) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const len = kind === 'thunder' ? 4.5 : 1.6;
    const buf = noiseBuffer(ctx, len, 'brown');
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(kind === 'thunder' ? 500 : 900, t); f.frequency.exponentialRampToValueAtTime(90, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (kind === 'thunder' ? 0.05 : 0.02));
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f); f.connect(g); g.connect(this.bus); src.start(t); src.stop(t + len);
  }
}
