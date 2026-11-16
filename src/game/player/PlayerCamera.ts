import * as THREE from 'three';
import type { CameraMode } from '../../types';
import { clamp, damp } from '../../utils/math';
import type { PlayerPhysics } from './PlayerPhysics';

export interface CamOpts { mode: CameraMode; fovEffects: boolean; shake: number; lag: number; mousePitch: number }

/** Cinematic chase camera: lag, speed pull-back, dive tilt, FOV kick and gentle turbulence. */
export class PlayerCamera {
  private dir = new THREE.Vector3(0, -0.2, -1);
  private pos = new THREE.Vector3();
  private tgt = new THREE.Vector3();
  private look = new THREE.Vector3();
  private up = new THREE.Vector3();
  private v = new THREE.Vector3();
  private fov = 70;
  private roll = 0;
  private dist = 8;
  private pitchOff = 0;
  private t = 0;
  private first = true;
  private shakeBoost = 0;

  constructor(public camera: THREE.PerspectiveCamera) {}

  snap() { this.first = true; }
  kick(amount: number) { this.shakeBoost = Math.max(this.shakeBoost, amount); }

  update(dt: number, p: PlayerPhysics, turb: number, o: CamOpts) {
    this.t += dt;
    const sp = p.speed, s01 = clamp(sp / 100, 0, 1.3);
    const fh = this.v.set(Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    const vl = Math.max(sp, 0.001);
    const hasV = p.flying;
    const vd = hasV ? new THREE.Vector3(p.vel.x / vl, p.vel.y / vl, p.vel.z / vl) : fh.clone().setY(-0.08);
    const mix = hasV ? 0.62 : 0;
    this.tgt.set(fh.x * (1 - mix) + vd.x * mix, fh.y * (1 - mix) + vd.y * mix, fh.z * (1 - mix) + vd.z * mix).normalize();
    this.pitchOff = damp(this.pitchOff, clamp(o.mousePitch, -0.5, 0.5), 3, dt);
    this.tgt.y += this.pitchOff; this.tgt.normalize();

    const lagK = (this.first ? 100 : 3.2 / Math.max(0.3, o.lag));
    this.dir.lerp(this.tgt, 1 - Math.exp(-lagK * dt)).normalize();

    const wide = o.mode === 'wide';
    const baseDist = o.mode === 'first' ? 0 : wide ? 15 : 8.5;
    this.dist = damp(this.dist, baseDist + (o.mode === 'first' ? 0 : s01 * 5), 3, dt);

    const head = this.v.set(p.pos.x, p.pos.y + 0.2, p.pos.z);
    let desired: THREE.Vector3;
    if (o.mode === 'first') desired = head.clone().addScaledVector(this.dir, 0.9);
    else desired = head.clone().addScaledVector(this.dir, -this.dist).add(new THREE.Vector3(0, 2.6 + (wide ? 2.5 : 0) + s01 * 0.6, 0));
    if (this.first) { this.pos.copy(desired); this.first = false; }
    else { const k = o.mode === 'first' ? 25 : 9 / Math.max(0.4, o.lag); this.pos.lerp(desired, 1 - Math.exp(-k * dt)); }

    // turbulence + speed shake (smooth, low frequency)
    const amp = o.shake * (0.012 + 0.05 * clamp((s01 - 0.4) / 0.8, 0, 1) + turb * 0.07) + this.shakeBoost * 0.6;
    this.shakeBoost = Math.max(0, this.shakeBoost - dt * 1.5);
    const t = this.t;
    const sx = (Math.sin(t * 17.3) + Math.sin(t * 29.1 + 1.3)) * amp, sy = (Math.sin(t * 21.7 + 2.1) + Math.sin(t * 33.3)) * amp;

    this.camera.position.set(this.pos.x + sx, this.pos.y + sy, this.pos.z);

    const targetRoll = o.mode === 'first' ? p.roll * 0.5 : p.roll * 0.3;
    this.roll = damp(this.roll, targetRoll, 4, dt);
    this.up.set(0, 1, 0).applyAxisAngle(this.dir, -this.roll);
    this.camera.up.copy(this.up);
    if (o.mode === 'first') this.look.copy(this.camera.position).addScaledVector(this.dir, 50);
    else this.look.copy(head).addScaledVector(this.dir, 18);
    this.camera.lookAt(this.look);

    const targetFov = 68 + (o.fovEffects ? s01 * 20 + (p.boosting ? 8 : 0) : 0) + (o.mode === 'first' ? 8 : 0);
    this.fov = damp(this.fov, targetFov, 3, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.02) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
  }
}
