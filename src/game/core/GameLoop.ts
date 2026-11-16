/** requestAnimationFrame loop with delta clamping. */
export class GameLoop {
  private raf = 0;
  private last = 0;
  running = false;

  constructor(private cb: (dt: number, raw: number) => void) {}

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const raw = (now - this.last) / 1000;
      this.last = now;
      this.cb(Math.min(raw, 0.05), raw);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }
}
