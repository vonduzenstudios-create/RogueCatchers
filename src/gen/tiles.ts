import { Texture } from 'pixi.js';
import { Rng } from '../engine/rng';
import { PALETTE } from './palette';
import { PixelCanvas, bayer, outline } from './pixels';

export const TILE = 16;

export const TILE_KINDS = [
  // Outdoors
  'grass',
  'flowers',
  'tallGrass',
  'path',
  'tree',
  'water',
  'fence',
  'sign',
  'sand',
  'rock',
  // Indoors
  'floor',
  'tileFloor',
  'stoneFloor',
  'wall',
  'counter',
  'shelf',
  'table',
  'rug',
  'mat',
  'machine',
  'plant',
  'statue',
] as const;
export type TileKind = (typeof TILE_KINDS)[number];

/** Tiles the player cannot walk through. */
export const SOLID: ReadonlySet<TileKind> = new Set([
  'tree',
  'water',
  'fence',
  'sign',
  'rock',
  'wall',
  'counter',
  'shelf',
  'table',
  'machine',
  'plant',
  'statue',
]);

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
  rock: (pc, r) => {
    DRAWERS.sand(pc, r, 0);
    const s = new PixelCanvas(TILE, TILE);
    s.disc(8, 9, 6, '#6a6470');
    s.disc(7, 8, 4, '#8a8590');
    s.disc(6, 6, 2, '#aaa5b0');
    for (let i = 0; i < 4; i++) s.set(r.int(4, 12), r.int(6, 13), '#4a4550');
    outline(s, '#2a2530');
    pc.ctx.drawImage(s.canvas, 0, 0);
  },
  floor: (pc, r) => {
    for (let y = 0; y < TILE; y++) {
      const seam = y % 4 === 3;
      pc.rect(0, y, TILE, 1, seam ? '#8a5a32' : '#c08a52');
    }
    for (let row = 0; row < 4; row++) {
      const x = (row * 7 + r.int(0, 3)) % TILE;
      pc.rect(x, row * 4, 1, 3, '#8a5a32');
    }
    for (let i = 0; i < 5; i++) pc.set(r.int(0, 15), r.int(0, 15), '#d09a62');
  },
  tileFloor: (pc) => {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const grout = x % 8 === 0 || y % 8 === 0;
        const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
        pc.set(x, y, grout ? '#b8c4cc' : checker ? '#f0f4f6' : '#dfe8ee');
      }
    }
  },
  stoneFloor: (pc, r) => {
    pc.rect(0, 0, TILE, TILE, '#8a8590');
    pc.rect(0, 7, TILE, 1, '#5a5560');
    pc.rect(0, 15, TILE, 1, '#5a5560');
    pc.rect(r.int(3, 12), 0, 1, 7, '#5a5560');
    pc.rect(r.int(3, 12), 8, 1, 7, '#5a5560');
    for (let i = 0; i < 6; i++) pc.set(r.int(0, 15), r.int(0, 15), r.pick(['#9a95a0', '#7a7580']));
  },
  wall: (pc) => {
    for (let x = 0; x < TILE; x++) pc.rect(x, 0, 1, 12, x % 4 < 2 ? '#e9dcb5' : '#ddcc9e');
    pc.rect(0, 12, TILE, 1, '#8a5a32');
    pc.rect(0, 13, TILE, 3, '#6b4a2b');
  },
  counter: (pc, r) => {
    DRAWERS.floor(pc, r, 0);
    pc.rect(0, 2, TILE, 4, '#e0b47a');
    pc.rect(0, 2, TILE, 1, '#f0d0a0');
    pc.rect(0, 6, TILE, 9, '#8a5a32');
    pc.rect(2, 8, 12, 5, '#7a4e2a');
    pc.rect(0, 15, TILE, 1, '#4a2e18');
  },
  shelf: (pc, r) => {
    pc.rect(0, 0, TILE, TILE, '#6b4a2b');
    for (const shelfY of [1, 8]) {
      let x = 1;
      while (x < 15) {
        const w = r.int(1, 2);
        const h = r.int(4, 6);
        pc.rect(x, shelfY + 6 - h, w, h, r.pick(['#d9483b', '#3b8fd9', '#4fa84a', '#f2c230', '#6b4a9c', '#e9dcb5']));
        x += w + (r.chance(0.2) ? 1 : 0);
      }
      pc.rect(0, shelfY + 6, TILE, 1, '#4a2e18');
    }
  },
  table: (pc, r) => {
    DRAWERS.floor(pc, r, 0);
    const t = new PixelCanvas(TILE, TILE);
    t.rect(1, 3, 14, 8, '#c99a62');
    t.rect(1, 3, 14, 1, '#e0b47a');
    t.rect(1, 11, 14, 2, '#8a5a32');
    t.rect(2, 13, 2, 2, '#6b4a2b');
    t.rect(12, 13, 2, 2, '#6b4a2b');
    outline(t, '#4a2e18');
    pc.ctx.drawImage(t.canvas, 0, 0);
  },
  rug: (pc) => {
    pc.rect(0, 0, TILE, TILE, '#a8322a');
    pc.rect(0, 1, TILE, 1, '#f2c230');
    pc.rect(0, 14, TILE, 1, '#f2c230');
    for (let x = 2; x < TILE; x += 4) pc.set(x, 7, '#f2c230');
  },
  mat: (pc) => {
    pc.rect(0, 0, TILE, TILE, '#3d6a4a');
    for (let y = 2; y < 14; y += 3) pc.rect(2, y, 12, 1, '#5a8a5a');
    pc.rect(0, 0, TILE, 1, '#2a4a32');
  },
  machine: (pc, r) => {
    DRAWERS.tileFloor(pc, r, 0);
    const m = new PixelCanvas(TILE, TILE);
    m.rect(1, 2, 14, 12, '#c4ccd4');
    m.rect(1, 2, 14, 1, '#eef2f6');
    m.rect(3, 4, 10, 4, '#2a6a8a');
    m.rect(4, 5, 3, 1, '#8fe3ff');
    for (const x of [3, 7, 11]) m.disc(x + 1, 11, 1, '#f07b2a');
    outline(m, '#2a2a3a');
    pc.ctx.drawImage(m.canvas, 0, 0);
  },
  plant: (pc, r) => {
    DRAWERS.floor(pc, r, 0);
    const p = new PixelCanvas(TILE, TILE);
    p.rect(5, 10, 6, 5, '#b05a32');
    p.rect(5, 10, 6, 1, '#d07a4a');
    p.disc(8, 6, 4, '#2f7a3e');
    p.disc(6, 5, 2, '#4fa055');
    p.disc(10, 4, 2, '#4fa055');
    outline(p, '#123320');
    pc.ctx.drawImage(p.canvas, 0, 0);
  },
  statue: (pc, r) => {
    DRAWERS.stoneFloor(pc, r, 0);
    const s = new PixelCanvas(TILE, TILE);
    s.rect(4, 11, 8, 4, '#6a6470');
    s.rect(5, 3, 6, 8, '#9a95a0');
    s.rect(5, 3, 2, 8, '#bab5c0');
    s.disc(8, 6, 2, '#f2c230');
    outline(s, '#2a2530');
    pc.ctx.drawImage(s.canvas, 0, 0);
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
