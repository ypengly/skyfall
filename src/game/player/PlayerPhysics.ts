
import { clamp, damp } from '../../utils/math';
import type { FlightMode, V3 } from '../../types';

export interface PhysInput {
  steer: number;
  dive: number;
  brake: number;
  boost: boolean;
  glide: boolean;
  mouseYaw: number;
}

export interface WindSample {
  x: number;
  y: number;
  z: number;
  turb: number;
}

const G = 9.81;

interface Aero {
  cd: number;
  cl: number;
  push: number;
  turn: number;
  auth: number;
  vmin: number;
}

/**
 * Flight physics presets.
 *
 * Glide: stable flight and controlled descent.
 * Dive: fast downward acceleration.
 * Brake: strong drag and improved control.
 * Freefall: realistic falling with limited steering.
 */
export const AERO: Record<string, Aero> = {
  freefall: {
    cd: G / (58 * 58),
    cl: 0.0004,
    push: 3,
    turn: 0.9,
    auth: 1.2,
    vmin: 14
  },

  dive: {
    cd: G / (90 * 90),
    cl: 0.00008,
    push: 9,
    turn: 0.65,
    auth: 1.0,
    vmin: 24
  },

  glide: {
    cd: 0.0015,
    cl: 0.006,
    push: 1.5,
    turn: 1.15,
    auth: 1.5,
    vmin: 16
  },

  brake: {
    cd: G / (24 * 24),
    cl: 0.0015,
    push: 0.5,
    turn: 1.0,
    auth: 1.5,
    vmin: 8
  }
};

export class PlayerPhysics {
  pos: V3 = { x: 0, y: 0, z: 0 };
  vel: V3 = { x: 0, y: 0, z: 0 };

  yaw = 0;
  roll = 0;
  yawRate = 0;

  mode: FlightMode = 'standing';

  cd = AERO.freefall.cd;
  cl = AERO.freefall.cl;
  push = AERO.freefall.push;
  turn = AERO.freefall.turn;
  auth = AERO.freefall.auth;
  vmin = AERO.freefall.vmin;

  boostEnergy = 1;
  boosting = false;

  speed = 0;
  hSpeed = 0;
  pathAngle = 0;

  private t = 0;

  reset(pos: V3, vel: V3, yaw: number, standing: boolean) {
    this.pos = { ...pos };
    this.vel = { ...vel };

    this.yaw = yaw;
    this.roll = 0;
    this.yawRate = 0;

    this.mode = standing ? 'standing' : 'glide';

    const a = AERO[standing ? 'freefall' : 'glide'];

    this.cd = a.cd;
    this.cl = a.cl;
    this.push = a.push;
    this.turn = a.turn;
    this.auth = a.auth;
    this.vmin = a.vmin;

    this.boostEnergy = 1;
    this.boosting = false;
    this.t = 0;

    this.refreshDerived();
  }

  jump() {
    if (this.mode !== 'standing') return;

    this.mode = 'freefall';

    this.vel = {
      x: Math.sin(this.yaw) * 10,
      y: 5,
      z: -Math.cos(this.yaw) * 10
    };
  }

  crash() {
    this.mode = 'crashed';
    this.vel = { x: 0, y: 0, z: 0 };
    this.refreshDerived();
  }

  land() {
    this.mode = 'landed';
    this.vel = { x: 0, y: 0, z: 0 };
    this.refreshDerived();
  }

  get flying() {
    return (
      this.mode === 'freefall' ||
      this.mode === 'dive' ||
      this.mode === 'glide' ||
      this.mode === 'brake'
    );
  }

  setMode(m: FlightMode) {
    if (this.flying) this.mode = m;
  }

  refreshDerived() {
    const v = this.vel;

    this.hSpeed = Math.hypot(v.x, v.z);
    this.speed = Math.hypot(v.x, v.y, v.z);

    this.pathAngle = Math.atan2(
      -v.y,
      Math.max(this.hSpeed, 0.001)
    );
  }

  step(dt: number, c: PhysInput, w: WindSample) {
    if (!this.flying) return;

    // Protect physics from large frame-time spikes.
    dt = clamp(dt, 0, 0.05);

    if (dt <= 0) return;

    const A = AERO[this.mode];

    // Smooth aerodynamic transitions.
    const k = 1 - Math.exp(-3.5 * dt);

    this.cd += (A.cd - this.cd) * k;
    this.cl += (A.cl - this.cl) * k;
    this.push += (A.push - this.push) * k;
    this.turn += (A.turn - this.turn) * k;
    this.auth += (A.auth - this.auth) * k;
    this.vmin += (A.vmin - this.vmin) * k;

    this.t += dt;

    // ----------------------------------
    // BOOST
    // ----------------------------------

    const wantBoost =
      c.boost && this.boostEnergy > 0.03;

    this.boosting = wantBoost;

    this.boostEnergy = clamp(
      this.boostEnergy +
        (wantBoost ? -0.28 : 0.12) * dt,
      0,
      1
    );

    // ----------------------------------
    // STEERING
    // ----------------------------------

    const steer = clamp(c.steer, -1, 1);

    const rate = this.turn *
      (this.boosting ? 0.85 : 1);

    const yawDelta =
      steer * rate * dt +
      clamp(c.mouseYaw, -0.15, 0.15);

    this.yaw += yawDelta;

    this.yawRate = yawDelta / Math.max(dt, 0.0001);

    this.roll = damp(
      this.roll,
      clamp(
        steer * 0.65 + this.yawRate * 0.12,
        -1,
        1
      ),
      5,
      dt
    );

    // ----------------------------------
    // AIRFLOW
    // ----------------------------------

    const v = this.vel;

    const rx = v.x - w.x;
    const ry = v.y - w.y;
    const rz = v.z - w.z;

    const s = Math.hypot(rx, ry, rz);

    const diveBoost =
      this.mode === 'dive' && this.boosting;

    let ax = 0;
    let ay = -G * (diveBoost ? 1.12 : 1);
    let az = 0;

    // ----------------------------------
    // DRAG
    // ----------------------------------

    const cd = this.cd *
      (this.boosting ? 0.82 : 1);

    ax -= cd * s * rx;
    ay -= cd * s * ry;
    az -= cd * s * rz;

    // ----------------------------------
    // AERODYNAMIC LIFT
    // ----------------------------------

    if (s > 1) {
      const ix = rx / s;
      const iy = ry / s;
      const iz = rz / s;

      const lx = -ix * iy;
      const ly = 1 - iy * iy;
      const lz = -iz * iy;

      const lm = Math.hypot(lx, ly, lz);

      if (lm > 0.001) {
        const lift = this.cl * s * s;

        ax += (lx / lm) * lift;
        ay += (ly / lm) * lift;
        az += (lz / lm) * lift;
      }
    }

    // ----------------------------------
    // SMART GLIDE STABILIZATION
    // ----------------------------------

    if (this.mode === 'glide') {
      // Desired downward speed.
      // Lower value means more stable flight.
      const targetSink = -clamp(
        2.2 + (22 - this.hSpeed) * 0.12,
        1.5,
        5
      );

      // Gradually recover excessive falling speed.
      const recovery = clamp(
        (targetSink - v.y) * 2.0,
        -8,
        8
      );

      ay += recovery;

      // Additional protection at low forward speed.
      if (this.hSpeed < 16) {
        const slowAssist = clamp(
          (16 - this.hSpeed) * 0.3,
          0,
          4
        );

        ay += slowAssist;
      }
    }

    // Brake helps control vertical descent.
    if (this.mode === 'brake') {
      const brakeRecovery = clamp(
        (-2.5 - v.y) * 1.2,
        -4,
        4
      );

      ay += brakeRecovery;
    }

    // ----------------------------------
    // HORIZONTAL STEERING
    // ----------------------------------

    const fx = Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);

    const hs = Math.hypot(v.x, v.z);

    const target = Math.max(hs, this.vmin);

    // Reduced steering force during sharp turns.
    const steeringForce = this.auth *
      (this.boosting ? 0.85 : 1);

    ax += steeringForce * (fx * target - v.x);
    az += steeringForce * (fz * target - v.z);

    // Forward acceleration.
    const push = this.push +
      (this.boosting ? 8 : 0);

    ax += fx * push;
    az += fz * push;

    // ----------------------------------
    // TURBULENCE
    // ----------------------------------

    const turbulence = clamp(w.turb, 0, 1);

    const tb = turbulence *
      (this.mode === 'brake' ? 0.3 : 0.65);

    ax += tb * 2.5 *
      (Math.sin(this.t * 6.1 + 1.3) +
       0.6 * Math.sin(this.t * 13.7));

    ay += tb * 1.5 *
      Math.sin(this.t * 7.7 + 2.1);

    az += tb * 2.5 *
      (Math.sin(this.t * 5.3 + 0.4) +
       0.6 * Math.sin(this.t * 11.1));

    // ----------------------------------
    // INTEGRATION
    // ----------------------------------

    v.x += ax * dt;
    v.y += ay * dt;
    v.z += az * dt;

    // Prevent extreme velocity.
    const sp = Math.hypot(v.x, v.y, v.z);

    if (sp > 150) {
      const f = 150 / sp;

      v.x *= f;
      v.y *= f;
      v.z *= f;
    }

    // Update position.
    this.pos.x += v.x * dt;
    this.pos.y += v.y * dt;
    this.pos.z += v.z * dt;

    this.refreshDerived();
  }
}
