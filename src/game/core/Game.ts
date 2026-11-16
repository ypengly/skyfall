import * as THREE from 'three';
import type { GameMode, RunResults, Settings, V3, Quality, HudData } from '../../types';
import { useGameStore } from '../../stores/gameStore';
import { clamp, damp, lerp } from '../../utils/math';
import { AssetManager } from '../systems/AssetManager';
import { InputManager } from '../systems/InputManager';
import { PerformanceManager, PRESETS } from '../systems/PerformanceManager';
import { SaveManager } from '../systems/SaveManager';
import { AudioManager } from '../audio/AudioManager';
import { DayNightCycle } from '../environment/DayNightCycle';
import { SkyDome } from '../environment/SkyDome';
import { LightingSystem } from '../environment/LightingSystem';
import { FogSystem } from '../environment/FogSystem';
import { WeatherSystem, WEATHER_PRESETS } from '../environment/WeatherSystem';
import { WindSystem } from '../environment/WindSystem';
import { AtmosphereFX } from '../environment/Precipitation';
import { ScreenEffects } from '../environment/ScreenEffects';
import { levels } from '../levels/LevelManager';
import { CHALLENGES } from '../levels/ChallengeDefs';
import { Player } from '../player/Player';
import { PlayerCamera } from '../player/PlayerCamera';
import type { WindSample } from '../player/PlayerPhysics';
import { World } from '../world/World';
import { mountains, START_Y, Z_MAX } from '../world/MountainGenerator';
import { ObstacleManager } from '../gameplay/ObstacleManager';
import { CollisionSystem } from '../gameplay/CollisionSystem';
import { CheckpointSystem } from '../gameplay/CheckpointSystem';
import { ProgressManager } from '../gameplay/ProgressManager';
import { ScoringSystem } from '../gameplay/ScoringSystem';
import { GameLoop } from './GameLoop';
import { GameState } from './GameState';

let instance: Game | null = null;
export const getGame = () => instance;

const LANDING_D = 12600;

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(68, 1, 1.5, 40000);
  state = new GameState();
  input: InputManager;
  perf = new PerformanceManager();
  assets = new AssetManager();
  audio = new AudioManager();
  dayNight = new DayNightCycle();
  weather = new WeatherSystem();
  wind = new WindSystem();
  screenFx: ScreenEffects;
  loop: GameLoop;
  progress = new ProgressManager();
  scoring: ScoringSystem;

  sky!: SkyDome; lighting!: LightingSystem; fog!: FogSystem; atmo!: AtmosphereFX;
  world!: World; player!: Player; cam!: PlayerCamera;
  obstacles!: ObstacleManager; collision!: CollisionSystem; checkpoints!: CheckpointSystem;

  private windSample: WindSample = { x: 0, y: 0, z: 0, turb: 0 };
  private prev: V3 = { x: 0, y: 0, z: 0 };
  private pv3 = new THREE.Vector3();
  private time = 0; private menuT = 0; private hudT = 0; private altitude = 1000;
  private forceTerrain = true; private hitCooldown = 0; private tips = new Set<number>();
  private builtEndless: boolean | null = null; private ready = false; private unsub: (() => void) | null = null;
  private pendingEnd: { completed: boolean; reason: string } | null = null;
  private lastChallenge = 0; private lastBolt = 0; private mousePitch = 0; private startedPlay = false;
  private onResize = () => this.resize();

  constructor(private canvas: HTMLCanvasElement, fxCanvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.screenFx = new ScreenEffects(fxCanvas);
    this.input = new InputManager(canvas);
    this.scoring = new ScoringSystem(this.state);
    this.loop = new GameLoop((dt, raw) => this.frame(dt, raw));
    this.input.onFirstGesture = () => this.audio.ensure();
    this.input.onLockChange = (locked) => { if (!locked && this.state.status === 'playing') this.pause(); };
    window.addEventListener('resize', this.onResize);
    instance = this;
  }

  /* ------------------------------------------------------------------ init */
  async init() {
    const ui = useGameStore.getState();
    const settings = ui.settings;
    this.perf.userQuality = settings.quality; this.perf.quality = settings.quality; this.perf.adaptive = settings.adaptive;
    const preset = PRESETS[settings.quality];
    await this.assets.runSteps([
      { label: 'Painting the sky', fn: () => {
        this.sky = new SkyDome(this.scene); this.lighting = new LightingSystem(this.scene); this.fog = new FogSystem(this.scene);
        this.atmo = new AtmosphereFX(this.scene, this.assets.textures.soft);
      } },
      { label: 'Sculpting the mountains', fn: () => {
        this.world = new World(this.scene, this.assets, preset);
        this.player = new Player(this.scene);
        this.cam = new PlayerCamera(this.camera);
        this.world.wildlife.callEagle = (x, y, z) => { const d = Math.hypot(x - this.camera.position.x, y - this.camera.position.y, z - this.camera.position.z); this.audio.env?.eagle(clamp(0.16 * (1 - d / 750), 0.02, 0.16)); };
      } },
      { label: 'Carving rivers and waterfalls', fn: () => { this.world.build(true); this.builtEndless = mountains.endless; } },
      { label: 'Placing obstacles and checkpoints', fn: () => {
        this.obstacles = new ObstacleManager(this.scene, this.wind);
        this.obstacles.build();
        this.checkpoints = new CheckpointSystem(this.scene);
        this.checkpoints.build();
        this.collision = new CollisionSystem(this.obstacles, this.world.forest, this.world.wildlife);
        this.obstacles.onStrike = () => { this.weather.flash = 1; this.audio.thunder(0.05, true); this.cam.kick(0.4); };
        this.obstacles.onRockSpawn = () => this.audio.rockfall();
      } },
      { label: 'Waking the wind', fn: () => {
        this.applyQuality(settings.quality, true);
        this.applySettings(settings, null);
        this.unsub = useGameStore.subscribe((s, p) => { if (s.settings !== p.settings) this.applySettings(s.settings, p.settings); });
        this.resize();
      } },
    ], (p, l) => ui.setLoading(p, l));
    this.ready = true;
    this.toMenu();
    this.loop.start();
  }

  dispose() {
    this.loop.stop(); this.unsub?.(); this.input.dispose();
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (instance === this) instance = null;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.perf.preset().pixelRatio));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.screenFx.resize();
  }

  applySettings(s: Settings, prev: Settings | null) {
    this.audio.setVolumes(s);
    this.input.mouseSens = s.mouseSens; this.input.invertY = s.invertY;
    this.perf.adaptive = s.adaptive;
    if (!prev || prev.quality !== s.quality) { this.perf.setUser(s.quality); this.applyQuality(s.quality); }
    if (this.state.status === 'playing') this.input.lockWanted = s.mouseLook;
  }

  applyQuality(q: Quality, silent = false) {
    this.perf.quality = q;
    const p = PRESETS[q];
    this.resize();
    this.renderer.shadowMap.enabled = p.shadows;
    this.lighting.setShadows(p.shadows, p.shadowMap);
    this.world.setQuality(p);
    this.world.terrain.setShadows(p.shadows);
    this.atmo.setLimits(p.rain, p.snow, p.leaves, p.lines);
    this.player.animation.setShadows(p.shadows);
    this.scene.traverse((o: any) => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x: THREE.Material) => (x.needsUpdate = true)); });
    this.forceTerrain = true;
    if (!silent && this.state.status === 'playing') useGameStore.getState().pushToast(`Graphics: ${q}`, 'info');
  }

  /* ----------------------------------------------------------- run control */
  private rebuildIfNeeded() {
    if (this.builtEndless === mountains.endless) return;
    this.builtEndless = mountains.endless;
    this.world.build(true); this.obstacles.build(); this.checkpoints.build();
    this.collision = new CollisionSystem(this.obstacles, this.world.forest, this.world.wildlife);
    this.forceTerrain = true;
  }

  startRun(mode: GameMode, opts: { challengeIndex?: number; fromSave?: boolean } = {}) {
    if (!this.ready) return;
    this.audio.ensure(); this.audio.sfx('click');
    const ui = useGameStore.getState();
    mountains.endless = mode === 'endless';
    this.rebuildIfNeeded();
    this.state.reset(mode);
    this.wind.scale = 1; this.tips.clear(); this.pendingEnd = null; this.startedPlay = false;
    this.checkpoints.removeGates();
    this.checkpoints.group.visible = true;
    this.checkpoints.rings.forEach((r) => { if (r.kind === 'cp') r.mesh.visible = !mountains.endless; });
    this.checkpoints.beacon.visible = !mountains.endless;
    this.obstacles.resetFlags();
    ui.setMode(mode); ui.setResults(null);
    ui.setExplore({ weather: 'auto', time: null });

    let spawnD = 0, standing = !mountains.endless;
    if (mode === 'challenge') {
      this.lastChallenge = clamp(opts.challengeIndex ?? 0, 0, CHALLENGES.length - 1);
      const ch = CHALLENGES[this.lastChallenge];
      this.state.challenge = ch; spawnD = ch.dStart; standing = ch.dStart === 0;
      if (ch.gates) { this.checkpoints.addGates(ch.dStart, ch.gates); this.state.gatesTotal = ch.gates; }
    } else if (opts.fromSave && ui.save.adventure && ui.save.adventure.cp > 0 && mode === 'adventure') {
      const sv = ui.save.adventure;
      Object.assign(this.state, { time: sv.time, crashes: sv.crashes, hits: sv.hits, nearMiss: sv.nearMiss, avoided: sv.avoided, maxSpeed: sv.maxSpeed, distance: sv.distance, gates: sv.gates, score: sv.score, cpIndex: sv.cp, started: true });
      spawnD = levels.levels[sv.cp - 1].dEnd; standing = false;
    }
    this.state.started = !standing;
    this.state.status = 'playing';
    this.spawn(spawnD, standing);
    const L = levels.at(spawnD);
    this.weather.snapTo(L.weather);
    this.dayNight.hours = mode === 'exploration' || mode === 'endless' ? L.hours[0] : levels.hoursAt(spawnD);
    this.state.levelIdx = -1;
    this.player.animation.setVisible(true);
    this.input.lockWanted = ui.settings.mouseLook; this.input.captureKeys = true; this.input.clearEdges();
    this.audio.setPaused(false);
    ui.setScreen('playing');
    if (standing) ui.pushToast('Press SPACE to jump', 'info');
  }

  private spawn(d: number, standing: boolean) {
    const p = this.player;
    if (standing && d === 0 && !mountains.endless) {
      const s = mountains.startPosition();
      p.reset({ x: s.x, y: s.y, z: s.z }, { x: 0, y: 0, z: 0 }, 0, true);
    } else {
      const yaw = mountains.pathYaw(d);
      const x = mountains.pathX(d), y = mountains.pathY(d), z = -Math.max(d, 5);
      p.reset({ x, y, z }, { x: Math.sin(yaw) * 38, y: -13, z: -Math.cos(yaw) * 38 }, yaw, false);
      p.physics.mode = 'glide'; p.controller.glide = true;
    }
    this.prev = { ...p.physics.pos };
    this.progress.update(p.physics.pos.z);
    this.checkpoints.setProgress(Math.max(0, -p.physics.pos.z), this.state.cpIndex);
    this.cam.snap(); this.forceTerrain = true; this.hitCooldown = 0; this.state.respawnTimer = 0;
  }

  private respawn() {
    const s = this.state; const L = levels;
    let d = 0, standing = false;
    if (s.challenge) { d = s.challenge.dStart; standing = d === 0; }
    else if (s.cpIndex > 0) d = L.levels[s.cpIndex - 1].dEnd;
    else standing = !mountains.endless;
    if (s.mode === 'endless') { d = Math.max(0, this.progress.d - 200); standing = false; }
    this.obstacles.resetFlags();
    this.spawn(d, standing);
    this.player.animation.setVisible(true);
    if (standing) s.started = false;
  }

  retry() { this.startRun(this.state.mode, { challengeIndex: this.lastChallenge }); }

  restartCheckpoint() { if (this.state.status === 'paused') { this.resume(); this.respawn(); } }
  restartLevel() {
    if (this.state.status !== 'paused') return;
    this.resume();
    const idx = this.progress.levelIdx; const d = levels.get(idx).dStart;
    this.obstacles.resetFlags();
    this.spawn(d, d === 0 && !mountains.endless);
    if (d === 0 && !mountains.endless) this.state.started = false;
  }

  pause() {
    if (this.state.status !== 'playing') return;
    this.state.status = 'paused'; this.input.lockWanted = false; this.input.releaseLock(); this.input.captureKeys = false;
    this.audio.setPaused(true);
    useGameStore.getState().setScreen('paused');
  }
  resume() {
    if (this.state.status !== 'paused') return;
    this.state.status = 'playing'; this.input.lockWanted = useGameStore.getState().settings.mouseLook; this.input.captureKeys = true; this.input.clearEdges();
    this.audio.setPaused(false);
    useGameStore.getState().setScreen('playing');
  }

  toMenu() {
    const ui = useGameStore.getState();
    this.state.status = 'menu'; this.input.lockWanted = false; this.input.releaseLock(); this.input.captureKeys = false;
    this.audio.setPaused(false);
    mountains.endless = false; this.rebuildIfNeeded();
    this.checkpoints.group.visible = false; this.checkpoints.beacon.visible = false;
    this.player.animation.setVisible(false);
    this.weather.snapTo(levels.get(0).weather); this.dayNight.hours = 6.9; this.menuT = 0;
    this.forceTerrain = true;
    ui.refreshSave(); ui.setScreen('menu');
  }

  /* ----------------------------------------------------------- frame logic */
  private frame(dt: number, raw: number) {
    if (!this.ready) return;
    this.time += dt;
    const inp = this.input.poll();
    const newQ = this.perf.update(raw, this.state.status === 'playing');
    if (newQ) this.applyQuality(newQ);
    const st = this.state.status;
    const ui = useGameStore.getState();

    if (st === 'playing') {
      if (inp.pause) this.pause();
      else this.updateRun(dt, inp);
      this.updateScene(dt, true);
    } else if (st === 'paused') {
      if (inp.pause) this.resume();
      this.updateScene(0, false);
    } else if (st === 'results') {
      this.updateScene(dt, false);
    } else {
      this.updateMenu(dt);
    }
    this.renderer.render(this.scene, this.camera);

    this.hudT += raw;
    if (this.hudT > 0.1 && (st === 'playing' || st === 'paused')) { this.hudT = 0; this.pushHud(ui.settings.showFps); }
  }

  private updateMenu(dt: number) {
    const t = (this.menuT += dt);
    const s = mountains.startPosition();
    this.camera.position.set(30 + 45 * Math.sin(t * 0.06), s.y + 35 + 6 * Math.sin(t * 0.13), -150 + 20 * Math.cos(t * 0.05));
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(-20 + 60 * Math.sin(t * 0.04), s.y - 260, -1500);
    if (Math.abs(this.camera.fov - 62) > 0.1) { this.camera.fov = 62; this.camera.updateProjectionMatrix(); }
    this.dayNight.hours = 6.9 + (t * 0.01);
    this.player.physics.pos = { x: s.x, y: s.y, z: s.z };
    this.progress.update(-300);
    this.windSample.x = 0; this.windSample.y = 0; this.windSample.z = 0; this.windSample.turb = 0;
    this.updateScene(dt, false, true);
  }

  private updateRun(dt: number, inp: ReturnType<InputManager['poll']>) {
    const s = this.state, P = this.player, p = P.physics, ui = useGameStore.getState();
    if (inp.camera) { const order = ['third', 'first', 'wide'] as const; ui.updateSettings({ camMode: order[(order.indexOf(ui.settings.camMode) + 1) % 3] }); }
    this.mousePitch = clamp(this.mousePitch + inp.mousePitch, -0.5, 0.5) * (1 - Math.min(1, dt * 0.8));
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    if (s.respawnTimer > 0) {
      s.respawnTimer -= dt;
      P.update(dt, { ...inp, jump: false }, this.windSample);
      if (s.respawnTimer <= 0) {
        if (this.pendingEnd) { const e = this.pendingEnd; this.pendingEnd = null; this.finishRun(e.completed, e.reason); }
        else this.respawn();
      }
      return;
    }

    this.prev = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    this.wind.sample(p.pos, this.weather.s.wind, this.weather.s.storm, this.windSample);
    const jumped = P.update(dt, inp, this.windSample);
    if (jumped) { s.started = true; this.audio.sfx('jump'); this.cam.kick(0.2); ui.pushToast('Free fall!', 'info'); }
    if (!p.flying) return;
    if (s.started) s.time += dt;

    this.progress.update(p.pos.z);
    s.maxSpeed = Math.max(s.maxSpeed, p.speed * 3.6);
    const step = Math.hypot(p.pos.x - this.prev.x, p.pos.y - this.prev.y, p.pos.z - this.prev.z);
    s.distance += step; this.scoring.distance(step);
    s.depth += Math.max(0, this.prev.y - p.pos.y);

    // endless loop teleport
    if (mountains.endless && this.progress.d >= Z_MAX) {
      p.pos.z += Z_MAX; p.pos.y += START_Y; this.prev.z += Z_MAX; this.prev.y += START_Y;
      s.loops++; this.wind.scale = 1 + 0.12 * s.loops;
      this.checkpoints.resetPassed(); this.obstacles.resetFlags(); this.forceTerrain = true; this.cam.snap();
      ui.pushToast(`Loop ${s.loops + 1} — the winds grow stronger`, 'info');
      this.progress.update(p.pos.z);
    }

    // stage change
    if (this.progress.levelIdx !== s.levelIdx) {
      s.levelIdx = this.progress.levelIdx;
      const L = levels.get(s.levelIdx);
      if (s.started) {
        ui.showLevelCard({ id: L.id, title: `STAGE ${L.id}`, sub: `${L.name} — ${L.subtitle}` });
        if (!this.tips.has(L.id)) { this.tips.add(L.id); setTimeout(() => useGameStore.getState().pushToast(L.tip, 'info'), 2600); }
      }
    }

    // collisions
    const exploring = s.mode === 'exploration';
    const res = this.collision.check(p.pos, true);
    this.altitude = res.altitude;
    if (res.nearMiss) for (let i = 0; i < res.nearMiss; i++) this.scoring.nearMiss();
    if (res.avoided) this.scoring.avoided(res.avoided);
    this.inCave = res.inCave;
    if (res.hits.length && this.hitCooldown <= 0) {
      this.hitCooldown = 1.2;
      this.scoring.hit(); this.audio.sfx('hit'); this.cam.kick(0.6); this.screenFx.hit();
      p.vel.x *= 0.7; p.vel.y *= 0.7; p.vel.z *= 0.7;
      ui.pushToast(res.hits[0] === 'bird' ? 'Bird strike!' : res.hits[0] === 'rock' ? 'Hit by a falling rock!' : 'Lightning strike!', 'bad');
    }

    // rings
    for (const ev of this.checkpoints.update(dt, this.prev, p.pos)) this.handleRing(ev.ring, ev.success);

    // ground contact / crash
    if (res.ground) {
      const sink = -p.vel.y, safe = !mountains.endless && this.progress.d >= LANDING_D && sink <= 28 && p.hSpeed <= 58;
      if (safe) { this.land(sink); return; }
      if (exploring) { p.pos.y = res.altitude < 0 ? p.pos.y - res.altitude + 3 : p.pos.y + 2; p.vel.y = Math.max(p.vel.y, 10); p.vel.x *= 0.6; p.vel.z *= 0.6; this.cam.kick(0.3); }
      else { this.crash(this.progress.d >= LANDING_D ? 'Landed too fast' : 'Hit the ground'); return; }
    } else if (res.crash && !exploring) { this.crash(`Crashed into a ${res.crash}`); return; }

    // challenge completion
    if (s.challenge && !s.challenge.landing && this.progress.d >= s.challenge.dEnd) { this.finishChallenge(false); return; }
    if (s.challenge?.landing && this.progress.d >= 13400 && p.pos.y < 200) { /* wait for touchdown */ }
  }

  inCave = false;

  private handleRing(r: { kind: string; idx: number }, ok: boolean) {
    const s = this.state, ui = useGameStore.getState();
    if (r.kind === 'guide') { if (ok) { this.scoring.guide(); this.audio.sfx('ring'); } return; }
    if (r.kind === 'gate') {
      if (ok) { this.scoring.gate(); this.audio.sfx('gate'); ui.pushToast(`Gate ${s.gates}/${s.gatesTotal}`, 'good'); }
      else { this.audio.sfx('miss'); ui.pushToast('Gate missed!', 'bad'); }
      return;
    }
    if (mountains.endless || s.challenge) return;
    if (ok) {
      s.cpIndex = Math.max(s.cpIndex, r.idx); this.scoring.checkpoint(); this.audio.sfx('checkpoint');
      ui.pushToast(`Checkpoint ${r.idx} / 9 reached`, 'good');
      if (s.mode === 'adventure') {
        SaveManager.update((d) => { d.adventure = { cp: s.cpIndex, time: s.time, crashes: s.crashes, hits: s.hits, nearMiss: s.nearMiss, avoided: s.avoided, maxSpeed: s.maxSpeed, distance: s.distance, gates: s.gates, score: s.score }; });
        ui.refreshSave();
      }
    } else { this.audio.sfx('miss'); ui.pushToast('Checkpoint missed — fly through the ring!', 'bad'); }
  }

  private crash(reason: string) {
    const s = this.state, ui = useGameStore.getState();
    this.player.physics.crash(); this.scoring.crash();
    this.audio.sfx('crash'); this.screenFx.crash(); this.cam.kick(1);
    ui.pushToast(reason, 'bad');
    s.respawnTimer = 1.7;
    if (s.mode === 'endless') this.pendingEnd = { completed: true, reason };
    else if (s.challenge && s.challenge.maxCrashes === 0) { this.pendingEnd = { completed: false, reason: 'Challenge failed — ' + reason.toLowerCase() }; }
  }

  private land(sink: number) {
    const s = this.state;
    this.player.physics.land(); this.audio.sfx('land'); this.cam.kick(0.2);
    if (s.challenge) { this.finishChallenge(true, sink); return; }
    this.finishRun(true, sink < 12 ? 'Perfect landing' : 'Safe landing');
  }

  private finishChallenge(landed: boolean, sink = 0) {
    const s = this.state, ch = s.challenge!;
    const lines: string[] = []; let ok = true;
    const chk = (cond: boolean, text: string) => { lines.push((cond ? '✓ ' : '✗ ') + text); if (!cond) ok = false; };
    if (ch.gates) chk(s.gates >= ch.gates, `Gates ${s.gates}/${ch.gates}`);
    if (ch.maxTime !== undefined) chk(s.time <= ch.maxTime, `Time ${s.time.toFixed(1)}s (max ${ch.maxTime}s)`);
    if (ch.minSpeedKmh !== undefined) chk(s.maxSpeed >= ch.minSpeedKmh, `Top speed ${Math.round(s.maxSpeed)} km/h (min ${ch.minSpeedKmh})`);
    if (ch.maxHits !== undefined) chk(s.hits <= ch.maxHits, `Hits ${s.hits} (max ${ch.maxHits})`);
    if (ch.maxCrashes !== undefined) chk(s.crashes <= ch.maxCrashes, `Crashes ${s.crashes} (max ${ch.maxCrashes})`);
    if (ch.minNearMiss !== undefined) chk(s.nearMiss >= ch.minNearMiss, `Near misses ${s.nearMiss}/${ch.minNearMiss}`);
    if (ch.landing) { chk(landed, 'Touched down'); if (landed && ch.maxSink !== undefined) chk(sink <= ch.maxSink, `Touchdown speed ${sink.toFixed(1)} m/s (max ${ch.maxSink})`); }
    this.finishRun(ok, ok ? 'Challenge complete!' : 'Challenge failed', { name: ch.name, success: ok, lines });
  }

  private finishRun(completed: boolean, reason: string, challenge?: RunResults['challenge']) {
    const s = this.state, ui = useGameStore.getState();
    s.status = 'results'; s.finished = true;
    this.input.lockWanted = false; this.input.releaseLock(); this.input.captureKeys = false;
    const par = levels.levels.reduce((a, l) => a + l.parTime, 0) * 0.85;
    const rating = s.mode === 'adventure' || s.mode === 'timetrial' ? this.scoring.rating(par, completed) : '—';
    let bestLabel = '', newRecord = false;
    const save = SaveManager.update((d) => {
      d.totalRuns++;
      if (s.mode === 'adventure' && completed) {
        const b = d.best.adventure; newRecord = !b || s.time < b.time;
        if (newRecord) d.best.adventure = { time: s.time, score: Math.floor(s.score), rating };
        d.adventure = null;
      } else if (s.mode === 'timetrial' && completed) {
        const b = d.best.timetrial; newRecord = !b || s.time < b.time;
        if (newRecord) d.best.timetrial = { time: s.time };
      } else if (s.mode === 'endless') {
        const b = d.best.endless; newRecord = !b || s.depth > b.depth;
        if (newRecord) d.best.endless = { depth: Math.floor(s.depth) };
      } else if (s.mode === 'challenge' && completed && s.challenge && !d.challengesDone.includes(s.challenge.id)) {
        d.challengesDone.push(s.challenge.id); newRecord = true;
      }
    });
    const fmt = (t: number) => `${Math.floor(t / 60)}:${(Math.floor(t % 60)).toString().padStart(2, '0')}`;
    if (s.mode === 'adventure') bestLabel = save.best.adventure ? `Best: ${fmt(save.best.adventure.time)} · score ${save.best.adventure.score}` : '';
    else if (s.mode === 'timetrial') bestLabel = save.best.timetrial ? `Best: ${fmt(save.best.timetrial.time)}` : '';
    else if (s.mode === 'endless') bestLabel = save.best.endless ? `Best depth: ${save.best.endless.depth.toLocaleString()} m` : '';
    else if (s.mode === 'challenge') bestLabel = `Challenges completed: ${save.challengesDone.length}/${CHALLENGES.length}`;
    ui.setResults({
      mode: s.mode, completed, reason, time: s.time, maxSpeed: s.maxSpeed, distance: s.distance,
      checkpoints: s.cpIndex, checkpointTotal: 9, avoided: s.avoided, nearMiss: s.nearMiss, hits: s.hits, crashes: s.crashes,
      rating, score: Math.floor(s.score), bestLabel, newRecord, depth: s.depth, challenge,
    });
    ui.refreshSave(); ui.setScreen('results');
  }

  /* --------------------------------------------------- scene / environment */
  private updateScene(dt: number, active: boolean, menu = false) {
    const ui = useGameStore.getState();
    const P = this.player, p = P.physics;
    const d = this.progress.d;
    const mode = this.state.mode;
    const cam = this.camera;

    // weather
    let target = levels.weatherAt(menu ? 0 : d);
    if (!menu && mode === 'exploration' && ui.explore.weather !== 'auto') target = WEATHER_PRESETS[ui.explore.weather] || target;
    this.weather.update(dt, target, {
      onLightning: (delay, strong) => { this.obstacles.decorBolt(p.pos); this.audio.thunder(delay, strong); },
    });

    // time of day
    if (!menu && (mode === 'adventure' || mode === 'timetrial' || mode === 'challenge')) this.dayNight.hours = damp(this.dayNight.hours, levels.hoursAt(d), 1.2, dt);
    else if (!menu && mode === 'exploration' && ui.explore.time !== null) this.dayNight.hours = ui.explore.time;
    else if (!menu) this.dayNight.hours += dt * 0.04;
    const sky = this.dayNight.compute();

    this.sky.update(sky, this.weather.s, this.weather.flash, this.time);
    this.sky.follow(cam.position);
    this.lighting.update(sky, this.weather.s, this.weather.flash, this.pv3.set(p.pos.x, p.pos.y, p.pos.z));
    this.wind.update(dt, this.weather.s.wind);

    // camera
    if (!menu) this.cam.update(dt, p, this.windSample.turb, { mode: ui.settings.camMode, fovEffects: ui.settings.fovEffects, shake: ui.settings.shake, lag: ui.settings.camLag, mousePitch: this.mousePitch });
    this.player.animation.setVisible(!menu && ui.settings.camMode !== 'first');

    const ground = mountains.heightAt(p.pos.x, p.pos.z);
    if (menu) this.altitude = cam.position.y - mountains.heightAt(cam.position.x, cam.position.z); else if (!active) this.altitude = p.pos.y - ground;

    this.world.clouds.update(dt, cam.position, this.wind.base.x, this.wind.base.z, this.weather.s.cloud, this.lighting.cloudTint, sky.dayF);
    this.fog.update(dt, this.weather.s, this.world.clouds.inside, this.wind.zoneFog, Math.max(0, this.altitude), this.lighting.cloudTint);
    this.world.update(dt, this.pv3.set(menu ? cam.position.x : p.pos.x, menu ? cam.position.y : p.pos.y, menu ? cam.position.z : p.pos.z), menu ? mountains.heightAt(cam.position.x, cam.position.z) : ground, this.forceTerrain);
    this.forceTerrain = false;
    this.world.waterfalls.update(this.time, sky.sunDir.y, sky.dayF, 1 - this.sky.overcast);

    if (active) this.obstacles.update(dt, p.pos, p.vel, p.flying, levels.at(d).lightning, levels.at(d).falling, () => { this.weather.flash = 1; });

    // atmosphere
    const biome = levels.biomeAt(d);
    const pv = menu ? { x: 0, y: 0, z: 0 } : p.vel;
    const speed01 = clamp(p.speed / 100, 0, 1.3);
    this.atmo.update(dt, {
      cam: cam.position, pv, wind: this.wind.base, rain: this.weather.s.rain, snow: Math.max(this.weather.s.snow, this.wind.zoneFog * 0.8),
      storm: this.weather.s.storm, speed01: menu ? 0 : speed01, altitude: this.altitude, green: biome.green, dark: biome.dark, dayF: sky.dayF, level: this.progress.levelIdx, light: sky.dayF,
    });
    this.screenFx.update(dt, { rain: this.weather.s.rain, flash: this.weather.flash, cloud: this.world.clouds.inside, speed01: menu ? 0 : speed01, enabled: true, vignette: ui.settings.fovEffects });

    // audio
    const wf = this.world.waterfalls.nearest(cam.position.x, cam.position.y, cam.position.z);
    let pan = 0;
    if (wf.dist < 1e8) { const r = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0); const vx = wf.x - cam.position.x, vz = wf.z - cam.position.z, l = Math.hypot(vx, vz) || 1; pan = (vx / l) * r.x + (vz / l) * r.z; }
    const hw = mountains.halfWidth(d);
    const river = d > 2000 && Math.abs(p.pos.x - mountains.pathX(d)) < hw ? clamp(1 - Math.max(0, this.altitude) / 700, 0, 1) : 0;
    this.audio.update(dt, {
      speed01: menu ? 0.05 : clamp(speed01, 0, 1), turb: this.windSample.turb, rain: this.weather.s.rain, snow: this.weather.s.snow, storm: this.weather.s.storm, wind: this.weather.s.wind,
      waterDist: wf.dist, waterPan: pan, riverNear: river, inCave: this.inCave && active, altitude: this.altitude, green: biome.green, dayF: sky.dayF, paused: false, active: !menu,
    }, clamp(speed01 * 0.8 + this.weather.s.storm * 0.3, 0, 1));
  }

  private pushHud(showFps: boolean) {
    const s = this.state, p = this.player.physics, L = this.progress.level;
    const ch = s.challenge;
    const parts: string[] = [];
    if (ch) {
      parts.push(ch.name);
      if (ch.gates) parts.push(`Gates ${s.gates}/${s.gatesTotal}`);
      if (ch.minNearMiss !== undefined) parts.push(`Near misses ${s.nearMiss}/${ch.minNearMiss}`);
      if (ch.maxTime !== undefined) parts.push(`${Math.floor(s.time)}/${ch.maxTime}s`);
      if (ch.minSpeedKmh !== undefined) parts.push(`Max ${Math.round(s.maxSpeed)}/${ch.minSpeedKmh} km/h`);
      if (ch.maxHits !== undefined) parts.push(`Hits ${s.hits}/${ch.maxHits}`);
    }
    const hud: HudData = {
      speed: p.speed * 3.6, altitude: Math.max(0, this.altitude), levelNo: L.id, levelName: L.name, envName: L.envName,
      weather: this.weather.label(), clock: DayNightCycle.clock(this.dayNight.hours), todLabel: DayNightCycle.label(this.dayNight.hours),
      distance: this.progress.remaining, progress: this.progress.progress, cpIndex: s.cpIndex, cpTotal: 9,
      flight: p.mode, fps: Math.round(this.perf.fps), timer: s.time, boost: p.boostEnergy, score: Math.floor(s.score),
      crashes: s.crashes, objective: parts.join('  ·  '), mode: s.mode, depth: s.depth, windWarn: this.wind.zoneName,
    };
    if (!showFps) hud.fps = 0;
    useGameStore.getState().setHud(hud);
  }
}

void lerp;
