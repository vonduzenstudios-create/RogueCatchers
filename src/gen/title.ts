import { Texture } from 'pixi.js';
import { Rng } from '../engine/rng';
import { PALETTE } from './palette';
import { ramp } from './color';
import { PixelCanvas, bayer, outline } from './pixels';

/** Dusk sky, stars and rolling hills for the title screen, all from a seed. */
export function titleBackdrop(width: number, height: number, seed = 'title'): Texture {
  const rng = new Rng(seed);
  const pc = new PixelCanvas(width, height);
  const sky = PALETTE.sky;
  const horizon = Math.floor(height * 0.72);

  // Banded sky with ordered dithering between neighbouring colours.
  for (let y = 0; y < horizon; y++) {
    const t = (y / horizon) * (sky.length - 1);
    const band = Math.min(sky.length - 2, Math.floor(t));
    const mix = t - band;
    for (let x = 0; x < width; x++) {
      pc.set(x, y, mix > bayer(x, y) ? sky[band + 1] : sky[band]);
    }
  }

  // Stars, denser near the top.
  for (let i = 0; i < 90; i++) {
    const y = Math.floor(Math.pow(rng.next(), 2) * horizon * 0.7);
    const x = rng.int(0, width - 1);
    pc.set(x, y, rng.chance(0.2) ? PALETTE.cream : PALETTE.white);
    if (rng.chance(0.08)) {
      pc.set(x - 1, y, sky[1]);
      pc.set(x + 1, y, sky[1]);
      pc.set(x, y - 1, sky[1]);
      pc.set(x, y + 1, sky[1]);
    }
  }

  // Setting sun.
  pc.disc(Math.floor(width * 0.72), horizon - 6, 14, '#ffcf7a');
  pc.disc(Math.floor(width * 0.72), horizon - 6, 11, '#ffe6a8');

  ridge(pc, rng.fork('far'), horizon - 18, 10, 0.03, PALETTE.hillFar);
  ridge(pc, rng.fork('near'), horizon + 2, 8, 0.05, PALETTE.hillNear);

  // Grassy foreground with tufts.
  for (let y = horizon + 16; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const shade = (y - horizon - 16) / (height - horizon - 16);
      pc.set(x, y, shade > 0.5 + bayer(x, y) * 0.4 ? PALETTE.grass[0] : PALETTE.grass[1]);
    }
  }
  const tufts = rng.fork('tufts');
  for (let i = 0; i < 120; i++) {
    const x = tufts.int(0, width - 1);
    const y = tufts.int(horizon + 14, height - 1);
    pc.set(x, y, PALETTE.grass[2]);
    pc.set(x, y - 1, PALETTE.grass[3]);
  }

  return pc.toTexture();
}

/** A hill line built from summed sine waves with seeded phases. */
function ridge(pc: PixelCanvas, rng: Rng, base: number, amp: number, freq: number, color: string): void {
  const phases = [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)];
  for (let x = 0; x < pc.width; x++) {
    const h =
      Math.sin(x * freq + phases[0]) * amp +
      Math.sin(x * freq * 2.3 + phases[1]) * amp * 0.4 +
      Math.sin(x * freq * 5.1 + phases[2]) * amp * 0.15;
    const top = Math.floor(base - h);
    pc.rect(x, top, 1, pc.height - top, color);
  }
}

/** The game's Catch Orb as a texture. */
export function catchOrb(): Texture {
  return drawCatchOrb().toTexture();
}

/** The game's Catch Orb, drawn at 16x16. */
export function drawCatchOrb(): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  const r = 6;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r + 3) continue;
      const lit = x + y < -3;
      const color = y < 0 ? (lit ? '#ffb347' : '#f07b2a') : lit ? '#ffffff' : '#d9d2c3';
      pc.set(8 + x, 8 + y, color);
    }
  }
  pc.rect(2, 8, 13, 1, PALETTE.ink);
  pc.disc(8, 8, 2, PALETTE.ink);
  pc.set(8, 8, '#8fe3ff');
  pc.set(5, 4, '#fff3d6');
  outline(pc, PALETTE.ink);
  return pc;
}

/** The Basalt Badge: a faceted stone hexagon with a gold rim. */
export function drawBadge(size = 24): PixelCanvas {
  const c = new PixelCanvas(size, size);
  const gold = ramp(42, 0.85, 0.5);
  const stone = ramp(20, 0.25, 0.42);
  const mid = (size - 1) / 2;
  const r = size / 2 - 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - mid;
      const dy = y - mid;
      // Hexagon distance (pointy top).
      const d = Math.max(Math.abs(dx) * 1.15, Math.abs(dx) * 0.58 + Math.abs(dy));
      if (d > r) continue;
      if (d > r - 2.2) {
        const lit = dx + dy < 0;
        c.set(x, y, gold[lit ? 2 : 0]);
      } else {
        // Facets: light from the top left, dithered at the seams.
        const shade = -dx * 0.6 - dy + (bayer(x, y) - 0.5) * 3;
        c.set(x, y, stone[shade > 2 ? 3 : shade > -1 ? 2 : shade > -4 ? 1 : 0]);
      }
    }
  }
  c.set(Math.round(mid - 3), Math.round(mid - 4), '#ffffff');
  outline(c, '#1d1a26');
  return c;
}
