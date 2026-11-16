import type { InputState } from '../../types';

/** Keyboard + mouse (pointer lock) + gamepad input. */
export class InputManager {
  keys = new Set<string>();
  locked = false;
  captureKeys = false;
  lockWanted = false;
  onLockChange: ((locked: boolean) => void) | null = null;
  onFirstGesture: (() => void) | null = null;
  mouseSens = 1;
  invertY = false;

  private mdx = 0; private mdy = 0;
  private edges = { jump: false, camera: false, pause: false };
  private padPrev: boolean[] = [];

  constructor(private el: HTMLElement) {
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    window.addEventListener('blur', this.blur);
    window.addEventListener('mousemove', this.mm);
    window.addEventListener('pointerdown', this.pd);
    document.addEventListener('pointerlockchange', this.plc);
    el.addEventListener('click', this.click);
  }

  dispose() {
    window.removeEventListener('keydown', this.kd);
    window.removeEventListener('keyup', this.ku);
    window.removeEventListener('blur', this.blur);
    window.removeEventListener('mousemove', this.mm);
    window.removeEventListener('pointerdown', this.pd);
    document.removeEventListener('pointerlockchange', this.plc);
    this.el.removeEventListener('click', this.click);
  }

  private kd = (e: KeyboardEvent) => {
    this.onFirstGesture?.();
    if (this.captureKeys && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'Space') this.edges.jump = true;
    if (e.code === 'KeyC') this.edges.camera = true;
    if (e.code === 'Escape' || e.code === 'KeyP') this.edges.pause = true;
  };
  private ku = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private blur = () => { this.keys.clear(); };
  private mm = (e: MouseEvent) => { if (this.locked) { this.mdx += e.movementX; this.mdy += e.movementY; } };
  private pd = () => { this.onFirstGesture?.(); };
  private plc = () => {
    this.locked = document.pointerLockElement === this.el;
    this.onLockChange?.(this.locked);
  };
  private click = () => {
    if (this.lockWanted && !this.locked) {
      try { (this.el as HTMLCanvasElement).requestPointerLock?.(); } catch { /* ignore */ }
    }
  };

  releaseLock() { if (document.pointerLockElement) document.exitPointerLock?.(); }
  clearEdges() { this.edges.jump = this.edges.camera = this.edges.pause = false; this.mdx = this.mdy = 0; }

  poll(): InputState {
    const k = this.keys;
    let steer = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let dive = k.has('KeyW') || k.has('ArrowUp') ? 1 : 0;
    let brake = k.has('KeyS') || k.has('ArrowDown') ? 1 : 0;
    let boost = k.has('ShiftLeft') || k.has('ShiftRight');
    let jump = this.edges.jump, camera = this.edges.camera, pause = this.edges.pause;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find((p) => p && p.connected);
    if (pad) {
      const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
      steer += dz(pad.axes[0] || 0);
      const ly = dz(pad.axes[1] || 0);
      if (ly < 0) dive = Math.max(dive, -ly); else brake = Math.max(brake, ly);
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      boost = boost || b(7) || b(5);
      const edge = (i: number) => { const now = b(i); const was = this.padPrev[i]; this.padPrev[i] = now; return now && !was; };
      if (edge(0)) jump = true;
      if (edge(3)) camera = true;
      if (edge(9)) pause = true;
    }
    const mouseYaw = this.mdx * 0.0022 * this.mouseSens;
    const mousePitch = this.mdy * 0.0022 * this.mouseSens * (this.invertY ? -1 : 1);
    this.edges.jump = this.edges.camera = this.edges.pause = false;
    this.mdx = 0; this.mdy = 0;
    return { steer: Math.max(-1, Math.min(1, steer)), dive, brake, boost, mouseYaw, mousePitch, jump, camera, pause };
  }
}
