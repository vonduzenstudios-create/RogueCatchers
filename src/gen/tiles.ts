import { Texture } from 'pixi.js';
import { Rng } from '../engine/rng';
import { PALETTE } from './palette';
import { PixelCanvas, bayer, outline } from './pixels';

export const TILE = 16;

export const TILE_KINDS = ['grass', 'flowers', 'tallGrass', 'path', 'tree', 'water', 'fence', 'sign', 'sand'] as const;
export type TileKind = (typeof TILE_KINDS)[number];

/** Tiles the player cannot walk through. */
export const SOLID: ReadonlySet<TileKind> = new Set(['tree', 'water', 'fence', 'sign']);

type Drawer = (pc: PixelCanvas, r: Rng, variant: number) => void;

const DRAWERS: Record<TileKind, Drawer> = {
  grass: grassBase,
  flowers: (pc, r) => {
    grassBase(pc, r);
    for (let i = 0; i < 3; i++) {
      const x = r.int(2, 13);
      const y = r.int(2, 13);
      const petal = r.pick(PALETTE.flower);
      pc.set(x - 1, y, petal);
      pc.set(x + 1, y, petal);
      pc.set(x, y - 1, petal);
      pc.set(x, y + 1, petal);
      pc.set(x, y, '#f2d15c');
    }
  },
  tallGrass: (pc, r) => {
    pc.rect(0, 0, TILE, TILE, PALETTE.grass[0]);
    // Rows of blades, each a dark stem with a light tip.
    for (let row = 0; row < 3; row++) {
      for (let x = r.int(0, 2); x < TILE; x += r.int(2, 4)) {
        const base = 5 + row * 5;
        const h = r.int(3, 5);
        pc.rect(x, base - h, 1, h, PALETTE.grass[1]);
        pc.set(x, base - h, PALETTE.grass[3]);
        pc.set(x + 1, base - h + 1, PALETTE.grass[2]);
      }
    }
  },
  path: (pc, r) => {
    pc.rect(0, 0, TILE, TILE, PALETTE.path[1]);
    for (let i = 0; i < 14; i++) pc.set(r.int(0, 15), r.int(0, 15), r.pick([PALETTE.path[0], PALETTE.path[2]]));
    if (r.chance(0.6)) {
      const x = r.int(2, 12);
      const y = r.int(2, 12);
      pc.rect(x, y, 2, 1, PALETTE.path[0]);
      pc.set(x, y - 1, PALETTE.path[2]);
    }
  },
  sand: (pc, r) => {
    pc.rect(0, 0, TILE, TILE, '#e3cf94');
    for (let i = 0; i < 18; i++) pc.set(r.int(0, 15), r.int(0, 15), r.pick(['#d1b97a', '#f0e0ac']));
  },
  tree: (pc, r) => {
    grassBase(pc, r);
    const canopy = new PixelCanvas(TILE, TILE);
    canopy.rect(7, 11, 2, 4, '#6b4a2b');
    canopy.disc(8, 7, 6, '#245a32');
    canopy.disc(7, 6, 4, '#2f7a3e');
    canopy.disc(6, 5, 2, '#4fa055');
    for (let i = 0; i < 5; i++) canopy.set(r.int(4, 11), r.int(3, 10), '#1c4a29');
    outline(canopy, '#123320');
    pc.ctx.drawImage(canopy.canvas, 0, 0);
  },
  // Water variants are animation frames: the ripple bands drift sideways.
  water: (pc, _r, variant) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const wave = Math.sin((x + variant * 4) * 0.4 + y * 0.9) + Math.sin((x - variant * 4) * 0.25 - y * 0.5);
        const v = wave * 0.25 + 0.5 + (bayer(x, y) - 0.5) * 0.3;
        pc.set(x, y, v > 0.95 ? '#cfefff' : v > 0.7 ? '#5fb4e8' : v > 0.2 ? '#3a8fd0' : '#2f74b4');
      }
    }
  },
  fence: (pc, r) => {
    grassBase(pc, r);
    const wood = new PixelCanvas(TILE, TILE);
    wood.rect(0, 6, TILE, 2, '#b98a52');
    wood.rect(0, 10, TILE, 2, '#b98a52');
    wood.rect(2, 3, 3, 11, '#c99a62');
    wood.rect(11, 3, 3, 11, '#c99a62');
    wood.rect(2, 3, 3, 1, '#e0b47a');
    wood.rect(11, 3, 3, 1, '#e0b47a');
    outline(wood, '#4a2e18');
    pc.ctx.drawImage(wood.canvas, 0, 0);
  },
  sign: (pc, r) => {
    grassBase(pc, r);
    const s = new PixelCanvas(TILE, TILE);
    s.rect(7, 9, 2, 6, '#8a5a32');
    s.rect(2, 2, 12, 8, '#c99a62');
    s.rect(2, 2, 12, 1, '#e0b47a');
    s.rect(4, 4, 8, 1, '#7a4e2a');
    s.rect(4, 6, 6, 1, '#7a4e2a');
    outline(s, '#4a2e18');
    pc.ctx.drawImage(s.canvas, 0, 0);
  },
};

/**
 * Draw a few variants of every tile kind. Variants share a palette but
 * differ in their speckles so large fields don't look stamped; for water
 * the variants are animation frames.
 */
export function drawTileset(seed = 'tiles', variants = 4): Record<TileKind, PixelCanvas[]> {
  const rng = new Rng(seed);
  const out = {} as Record<TileKind, PixelCanvas[]>;
  for (const kind of TILE_KINDS) {
    out[kind] = Array.from({ length: variants }, (_, i) => {
      const pc = new PixelCanvas(TILE, TILE);
      DRAWERS[kind](pc, rng.fork(`${kind}-${i}`), i);
      return pc;
    });
  }
  return out;
}

export function generateTileset(seed = 'tiles', variants = 4): Record<TileKind, Texture[]> {
  const canvases = drawTileset(seed, variants);
  const out = {} as Record<TileKind, Texture[]>;
  for (const kind of TILE_KINDS) out[kind] = canvases[kind].map((pc) => pc.toTexture());
  return out;
}

function grassBase(pc: PixelCanvas, r: Rng): void {
  pc.rect(0, 0, TILE, TILE, PALETTE.grass[1]);
  for (let i = 0; i < 10; i++) pc.set(r.int(0, 15), r.int(0, 15), PALETTE.grass[0]);
  for (let i = 0; i < 6; i++) {
    const x = r.int(0, 15);
    const y = r.int(1, 15);
    pc.set(x, y, PALETTE.grass[2]);
    pc.set(x, y - 1, PALETTE.grass[3]);
  }
}
