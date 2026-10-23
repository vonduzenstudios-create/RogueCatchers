import { Texture } from 'pixi.js';
import { Rng } from '../engine/rng';
import { PALETTE } from './palette';
import { PixelCanvas, outline } from './pixels';

export const TILE = 16;

export type TileKind = 'grass' | 'flowers' | 'tallGrass' | 'path' | 'tree';

/** Tiles the player cannot walk through. */
export const SOLID: ReadonlySet<TileKind> = new Set(['tree']);

/**
 * Generate a few variants of every tile kind. Variants share a palette
 * but differ in their speckles so large fields don't look stamped.
 */
export function generateTileset(seed = 'tiles', variants = 4): Record<TileKind, Texture[]> {
  const rng = new Rng(seed);
  const make = (kind: TileKind, draw: (pc: PixelCanvas, r: Rng) => void) =>
    Array.from({ length: variants }, (_, i) => {
      const pc = new PixelCanvas(TILE, TILE);
      draw(pc, rng.fork(`${kind}-${i}`));
      return pc.toTexture();
    });

  return {
    grass: make('grass', grassBase),
    flowers: make('flowers', (pc, r) => {
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
    }),
    tallGrass: make('tallGrass', (pc, r) => {
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
    }),
    path: make('path', (pc, r) => {
      pc.rect(0, 0, TILE, TILE, PALETTE.path[1]);
      for (let i = 0; i < 14; i++) pc.set(r.int(0, 15), r.int(0, 15), r.pick([PALETTE.path[0], PALETTE.path[2]]));
      if (r.chance(0.6)) {
        const x = r.int(2, 12);
        const y = r.int(2, 12);
        pc.rect(x, y, 2, 1, PALETTE.path[0]);
        pc.set(x, y - 1, PALETTE.path[2]);
      }
    }),
    tree: make('tree', (pc, r) => {
      grassBase(pc, r);
      const canopy = new PixelCanvas(TILE, TILE);
      canopy.rect(7, 11, 2, 4, '#6b4a2b');
      canopy.disc(8, 7, 6, '#245a32');
      canopy.disc(7, 6, 4, '#2f7a3e');
      canopy.disc(6, 5, 2, '#4fa055');
      for (let i = 0; i < 5; i++) canopy.set(r.int(4, 11), r.int(3, 10), '#1c4a29');
      outline(canopy, '#123320');
      pc.ctx.drawImage(canopy.canvas, 0, 0);
    }),
  };
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
