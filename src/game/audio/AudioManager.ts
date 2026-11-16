import type { Settings } from '../../types';
import { EnvironmentAudio, EnvAudioState, makeImpulse } from './EnvironmentAudio';

const CHORDS = [
  [220, 261.63, 329.63, 392], [174.61, 220, 261.63, 349.23], [196, 246.94, 293.66, 392], [164.81, 196, 246.94, 329.63],
];

/** Web Audio engine: master/music/sfx buses, adaptive environment layers, generative ambient music, SFX. */
export class AudioManager {
  ctx: AudioContext | null = null;
  env: EnvironmentAudio | null = null;
  private master!: GainNode; private music!: GainNode; private sfxBus!: GainNode; private duck!: GainNode;
  private voices: { osc: OscillatorNode; osc2: OscillatorNode }[] = [];
  private bass!: OscillatorNode;
  private musicFilter!: BiquadFilterNode;
  private musicSend!: GainNode;
  private chordIdx = 0; private chordT = 0; private arpT = 0; private arpStep = 0;
  private vols = { master: 0.8, music: 0.5, sfx: 0.8 };
  private paused = false;

  /** Must be called from a user gesture. */
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    if (!AC) return;
    const ctx = new AC(); this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.duck = ctx.createGain();
    this.master.connect(this.duck); this.duck.connect(comp); comp.connect(ctx.destination);
    this.music = ctx.createGain(); this.sfxBus = ctx.createGain();
    this.music.connect(this.master); this.sfxBus.connect(this.master);
    this.env = new EnvironmentAudio(ctx, this.sfxBus);
    this.buildMusic();
    this.applyVolumes();
  }

  private buildMusic() {
    const ctx = this.ctx!;
    this.musicFilter = ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 900;
    const conv = ctx.createConvolver(); conv.buffer = makeImpulse(ctx, 3.5, 2.0);
    this.musicSend = ctx.createGain(); this.musicSend.gain.value = 0.55;
    this.musicFilter.connect(this.music); this.musicFilter.connect(this.musicSend); this.musicSend.connect(conv); conv.connect(this.music);
    CHORDS[0].forEach((f, i) => {
      const g = ctx.createGain(); g.gain.value = 0.045;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = -6;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f; o2.detune.value = 7;
      o.connect(g); o2.connect(g); g.connect(this.musicFilter); o.start(); o2.start();
      this.voices.push({ osc: o, osc2: o2 });
      void i;
    });
    this.bass = ctx.createOscillator(); this.bass.type = 'sine'; this.bass.frequency.value = 55;
    const bg = ctx.createGain(); bg.gain.value = 0.09; this.bass.connect(bg); bg.connect(this.musicFilter); this.bass.start();
  }

  setVolumes(s: Pick<Settings, 'master' | 'music' | 'sfx'>) { this.vols = { master: s.master, music: s.music, sfx: s.sfx }; this.applyVolumes(); }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vols.master, t, 0.05);
    this.music.gain.setTargetAtTime(this.vols.music * 1.3, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vols.sfx, t, 0.05);
  }

  setPaused(p: boolean) { this.paused = p; if (this.ctx) this.duck.gain.setTargetAtTime(p ? 0.3 : 1, this.ctx.currentTime, 0.1); }

  update(dt: number, s: EnvAudioState, musicIntensity: number) {
    if (!this.ctx || !this.env) return;
    this.env.update(dt, { ...s, paused: this.paused });
    const t = this.ctx.currentTime;
    this.musicFilter.frequency.setTargetAtTime(700 + musicIntensity * 1800, t, 0.5);
    this.chordT -= dt;
    if (this.chordT <= 0) {
      this.chordT = 9; this.chordIdx = (this.chordIdx + 1) % CHORDS.length;
      const ch = CHORDS[this.chordIdx];
      this.voices.forEach((v, i) => { v.osc.frequency.setTargetAtTime(ch[i], t, 1.6); v.osc2.frequency.setTargetAtTime(ch[i], t, 1.6); });
      this.bass.frequency.setTargetAtTime(ch[0] / 4, t, 1.2);
    }
    this.arpT -= dt;
    if (this.arpT <= 0) {
      this.arpT = 2.25 / (1 + musicIntensity * 0.6);
      const ch = CHORDS[this.chordIdx];
      this.bell(ch[this.arpStep++ % 4] * 2, 0.035);
    }
  }

  private bell(freq: number, vol: number) {
    const ctx = this.ctx!, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g); g.connect(this.musicFilter); o.start(t); o.stop(t + 2.3);
  }

  sfx(name: 'checkpoint' | 'ring' | 'gate' | 'crash' | 'hit' | 'click' | 'jump' | 'land' | 'miss') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const tone = (f: number, d: number, vol: number, type: OscillatorType = 'sine', start = 0, f2?: number) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t + start);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + start + d);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + start); g.gain.linearRampToValueAtTime(vol, t + start + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + start + d);
      o.connect(g); g.connect(this.sfxBus); o.start(t + start); o.stop(t + start + d + 0.05);
    };
    switch (name) {
      case 'checkpoint': tone(660, 0.5, 0.25); tone(880, 0.6, 0.22, 'sine', 0.12); tone(1320, 0.9, 0.18, 'sine', 0.26); break;
      case 'ring': tone(980, 0.25, 0.1, 'sine', 0, 1250); break;
      case 'gate': tone(780, 0.3, 0.16); tone(1170, 0.35, 0.12, 'sine', 0.08); break;
      case 'miss': tone(220, 0.3, 0.1, 'triangle', 0, 160); break;
      case 'click': tone(1200, 0.06, 0.08, 'square'); break;
      case 'jump': tone(180, 0.5, 0.2, 'sine', 0, 70); break;
      case 'land': tone(110, 0.8, 0.3, 'sine', 0, 55); tone(660, 0.5, 0.15, 'sine', 0.1); tone(990, 0.7, 0.12, 'sine', 0.25); break;
      case 'hit': tone(150, 0.25, 0.3, 'sawtooth', 0, 60); this.env?.burst('rock', 0.4); break;
      case 'crash': tone(90, 0.9, 0.5, 'sine', 0, 35); tone(60, 1.2, 0.4, 'triangle', 0, 30); this.env?.burst('rock', 0.9); break;
    }
  }

  thunder(delay: number, strong: boolean) { this.env?.burst('thunder', strong ? 0.9 : 0.55, delay); }
  rockfall() { this.env?.burst('rock', 0.35); }
}
