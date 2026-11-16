import { clamp } from '../../utils/math';

interface Drop { x: number; y: number; r: number; life: number; vx: number; vy: number }

/** 2D overlay canvas: rain droplets on the lens, lightning flash, cloud whiteout, crash flash, speed vignette. */
export class ScreenEffects {
  private ctx: CanvasRenderingContext2D;
  private w = 1; private h = 1;
  private drops: Drop[] = [];
  private crashFlash = 0;
  private hitFlash = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * dpr); this.canvas.height = Math.floor(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  crash() { this.crashFlash = 1; }
  hit() { this.hitFlash = 1; }

  update(dt: number, p: { rain: number; flash: number; cloud: number; speed01: number; enabled: boolean; vignette: boolean }) {
    const c = this.ctx, w = this.w, h = this.h;
    c.clearRect(0, 0, w, h);
    if (!p.enabled) { this.drops.length = 0; return; }

    if (p.vignette && p.speed01 > 0.15) {
      const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${clamp((p.speed01 - 0.15) * 0.5, 0, 0.4)})`);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }
    if (p.cloud > 0.02) { c.fillStyle = `rgba(232,238,248,${clamp(p.cloud * 0.8, 0, 0.82)})`; c.fillRect(0, 0, w, h); }
    if (p.flash > 0.02) { c.fillStyle = `rgba(215,228,255,${clamp(p.flash * 0.4, 0, 0.5)})`; c.fillRect(0, 0, w, h); }
    if (this.crashFlash > 0.01) { c.fillStyle = `rgba(150,8,8,${this.crashFlash * 0.6})`; c.fillRect(0, 0, w, h); this.crashFlash = Math.max(0, this.crashFlash - dt * 0.9); }
    if (this.hitFlash > 0.01) { c.fillStyle = `rgba(255,255,255,${this.hitFlash * 0.35})`; c.fillRect(0, 0, w, h); this.hitFlash = Math.max(0, this.hitFlash - dt * 3); }

    // droplets
    if (p.rain > 0.05 && this.drops.length < 70) {
      const n = p.rain * dt * 14 * (1 + p.speed01 * 2);
      let k = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      while (k-- > 0) this.drops.push({ x: Math.random() * w, y: Math.random() * h, r: 3 + Math.random() * 7, life: 1.2 + Math.random() * 2, vx: (Math.random() - 0.5) * 20, vy: -(10 + p.speed01 * 260) });
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt; d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.life <= 0 || d.y < -20) { this.drops.splice(i, 1); continue; }
      const a = clamp(d.life, 0, 1);
      c.beginPath(); c.ellipse(d.x, d.y, d.r * 0.8, d.r, 0, 0, Math.PI * 2);
      c.fillStyle = `rgba(210,225,245,${0.1 * a})`; c.fill();
      c.strokeStyle = `rgba(255,255,255,${0.35 * a})`; c.lineWidth = 1; c.stroke();
      c.beginPath(); c.arc(d.x - d.r * 0.25, d.y - d.r * 0.35, d.r * 0.22, 0, Math.PI * 2);
      c.fillStyle = `rgba(255,255,255,${0.6 * a})`; c.fill();
    }
  }
}
