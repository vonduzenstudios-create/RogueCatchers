import { Rng } from '../engine/rng';
import { PixelCanvas, bayer } from './pixels';

export type Arena = 'grass' | 'indoor' | 'gym';

interface ArenaColors {
  sky: [string, string];
  ground: [string, string];
  platform: [string, string, string];
}

const ARENAS: Record<Arena, ArenaColors> = {
  grass: { sky: ['#bfe3f2', '#f2f0d0'], ground: ['#8fcf7a', '#7cc46c'], platform: ['#4f9a4a', '#6ab45e', '#3d7a3a'] },
  indoor: { sky: ['#e9dcb5', '#f4ecd2'], ground: ['#c08a52', '#b07a42'], platform: ['#8a5a32', '#a06a3a', '#6b4a2b'] },
  gym: { sky: ['#5a5560', '#8a8590'], ground: ['#9a95a0', '#8a8590'], platform: ['#6a6470', '#7a7580', '#4a4550'] },
};

/** Battle background: dithered sky, a ground plane, and two oval platforms. */
export function drawBattleBackdrop(w: number, h: number, arena: Arena): PixelCanvas {
  const c = ARENAS[arena];
  const pc = new PixelCanvas(w, h);
  const horizon = Math.floor(h * 0.42);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < horizon) {
        pc.set(x, y, y / horizon > 0.3 + bayer(x, y) * 0.6 ? c.sky[1] : c.sky[0]);
      } else {
        const t = (y - horizon) / (h - horizon);
        pc.set(x, y, t > bayer(x, y) * 0.8 + 0.1 ? c.ground[1] : c.ground[0]);
      }
    }
  }
  if (arena === 'grass') {
    // Distant hedges on the horizon.
    const rng = new Rng('battle-hedges');
    for (let x = 0; x < w; x += rng.int(10, 18)) pc.disc(x, horizon, rng.int(5, 9), '#6ab45e');
    pc.rect(0, horizon, w, 3, '#5aa450');
  }
  drawPlatform(pc, 236, 88, 52, 12, c.platform);
  drawPlatform(pc, 84, 128, 60, 13, c.platform);
  return pc;
}

function drawPlatform(pc: PixelCanvas, cx: number, cy: number, rx: number, ry: number, colors: [string, string, string]): void {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d > 1) continue;
      const rim = d > 0.78;
      const lit = y < -ry * 0.2 && x < 0;
      pc.set(cx + x, cy + y, rim ? colors[2] : lit ? colors[1] : colors[0]);
    }
  }
}
