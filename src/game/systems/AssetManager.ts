import * as THREE from 'three';
import { mulberry32 } from '../../utils/math';

export interface LoadStep { label: string; fn: () => void | Promise<void> }

/**
 * All art is procedural: textures are painted on canvases at start-up, so the
 * game never depends on external files. Loading is progressive (step by step)
 * so the loading screen can update between heavy generation steps.
 */
export class AssetManager {
  textures: Record<string, THREE.Texture> = {};

  constructor() { this.createTextures(); }

  async runSteps(steps: LoadStep[], onProgress: (p: number, label: string) => void) {
    for (let i = 0; i < steps.length; i++) {
      onProgress(i / steps.length, steps[i].label);
      await new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      await steps[i].fn();
    }
    onProgress(1, 'Ready');
    await new Promise<void>((r) => setTimeout(r, 120));
  }

  private tex(canvas: HTMLCanvasElement) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private createTextures() {
    // soft circle
    let c = document.createElement('canvas'); c.width = c.height = 64;
    let g = c.getContext('2d')!;
    let gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.textures.soft = this.tex(c);

    // cloud puff
    c = document.createElement('canvas'); c.width = c.height = 256;
    g = c.getContext('2d')!;
    const rng = mulberry32(42);
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2, r = rng() * 70;
      const x = 128 + Math.cos(a) * r * 1.2, y = 128 + Math.sin(a) * r * 0.55;
      const rad = 28 + rng() * 44;
      gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.38)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    }
    this.textures.cloud = this.tex(c);

    // mist (very soft, wide)
    c = document.createElement('canvas'); c.width = c.height = 128;
    g = c.getContext('2d')!;
    gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    this.textures.mist = this.tex(c);
  }

  dispose() { Object.values(this.textures).forEach((t) => t.dispose()); }
}
