import { Texture } from 'pixi.js';
import { Rng } from '../engine/rng';
import { hsl } from './color';
import { PALETTE } from './palette';
import { PixelCanvas, outline } from './pixels';

export type Facing = 'down' | 'up' | 'left' | 'right';
export const FACINGS: Facing[] = ['down', 'up', 'left', 'right'];

export interface Outfit {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  hairStyle?: 'short' | 'spiky' | 'long';
  /** A long coat over the shirt, e.g. the professor's lab coat. */
  coat?: string;
  hat?: string;
}

export const PLAYER_OUTFIT: Outfit = {
  skin: '#f1c39b',
  hair: '#3b2a4a',
  shirt: '#d9483b',
  pants: '#2f4a7a',
  hat: '#d9483b',
};

export const RIVAL_OUTFIT: Outfit = {
  skin: '#e8b48a',
  hair: '#e07a2f',
  shirt: '#2f6fb0',
  pants: '#2a2a3a',
  hairStyle: 'spiky',
};

export const PROFESSOR_OUTFIT: Outfit = {
  skin: '#f1c39b',
  hair: '#b8b4c4',
  shirt: '#5a7a4a',
  pants: '#4a3a2a',
  coat: '#f4f1e8',
};

export const GYM_LEADER_OUTFIT: Outfit = {
  skin: '#9a6a48',
  hair: '#2a1e1a',
  shirt: '#7a6a58',
  pants: '#3a3230',
  hat: '#c08a3a',
};

/** A random but reproducible townsperson. */
export function townsfolkOutfit(seed: string): Outfit {
  const r = new Rng(seed);
  const skins = ['#f6d2b0', '#f1c39b', '#d9a27a', '#b07a52', '#8a5a3c'];
  const hairs = ['#2a1e1a', '#5a3a22', '#c08a3a', '#e8d27a', '#b8b4c4', '#7a3a2a'];
  return {
    skin: r.pick(skins),
    hair: r.pick(hairs),
    shirt: hsl(r.int(0, 359), r.range(0.4, 0.7), r.range(0.4, 0.6)),
    pants: hsl(r.int(180, 280), r.range(0.15, 0.4), r.range(0.2, 0.35)),
    hairStyle: r.pick(['short', 'short', 'long', 'spiky'] as const),
    hat: r.chance(0.25) ? hsl(r.int(0, 359), 0.5, 0.45) : undefined,
  };
}

/** Paper-doll character: 16x16 frames per facing, frame 0 standing, 1 stepping. */
export function drawCharacterFrames(outfit: Outfit): Record<Facing, PixelCanvas[]> {
  const frames = (facing: Facing) => [0, 1].map((step) => drawCharacter(outfit, facing, step));
  return { down: frames('down'), up: frames('up'), left: frames('left'), right: frames('right') };
}

export function generateCharacter(outfit: Outfit): Record<Facing, Texture[]> {
  const canvases = drawCharacterFrames(outfit);
  const toTextures = (f: Facing) => canvases[f].map((pc) => pc.toTexture());
  return { down: toTextures('down'), up: toTextures('up'), left: toTextures('left'), right: toTextures('right') };
}

function drawCharacter(o: Outfit, facing: Facing, step: number): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  const side = facing === 'left' || facing === 'right';
  const front = facing === 'right' ? 1 : -1;

  // Legs: alternate which leg is forward while stepping.
  if (side && step) {
    pc.rect(5, 12, 2, 3, o.pants);
    pc.rect(9, 12, 2, 3, o.pants);
  } else if (side) {
    pc.rect(7, 12, 2, 3, o.pants);
  } else {
    pc.rect(5, 12, 2, step ? 2 : 3, o.pants);
    pc.rect(9, 12, 2, 3, o.pants);
  }

  // Body, coat and arms.
  pc.rect(5, 8, 6, 5, o.shirt);
  if (o.coat) {
    if (facing === 'down') {
      pc.rect(4, 8, 2, 6, o.coat);
      pc.rect(10, 8, 2, 6, o.coat);
    } else {
      pc.rect(5, 8, 6, 6, o.coat);
    }
  }
  if (!side) {
    pc.rect(4, 9, 1, 3, o.coat ?? o.skin);
    pc.rect(11, 9, 1, 3, o.coat ?? o.skin);
    pc.set(4, 11, o.skin);
    pc.set(11, 11, o.skin);
  } else {
    pc.rect(8 - front, 9, 1, 3, o.coat ?? o.shirt);
    pc.set(8 - front, 11, o.skin);
  }

  // Head and hair.
  pc.disc(8, 5, 3, o.skin);
  if (facing === 'up') {
    pc.disc(8, 5, 3, o.hair);
    if (o.hairStyle === 'long') pc.rect(5, 6, 7, 3, o.hair);
  } else {
    pc.rect(5, 2, 7, 2, o.hair);
    pc.set(5, 4, o.hair);
    pc.set(11, 4, o.hair);
    if (o.hairStyle === 'long') {
      pc.rect(4, 3, 1, 5, o.hair);
      pc.rect(12, 3, 1, 5, o.hair);
    }
    if (facing === 'down') {
      pc.set(7, 5, PALETTE.ink);
      pc.set(9, 5, PALETTE.ink);
    } else {
      // Side view: hair at the back, one eye at the front.
      const back = facing === 'right' ? 5 : 10;
      pc.rect(back, 3, 2, 3, o.hair);
      if (o.hairStyle === 'long') pc.rect(back, 6, 2, 3, o.hair);
      pc.set(facing === 'right' ? 10 : 6, 5, PALETTE.ink);
    }
  }
  if (o.hairStyle === 'spiky') {
    pc.set(6, 1, o.hair);
    pc.set(8, 0, o.hair);
    pc.set(8, 1, o.hair);
    pc.set(10, 1, o.hair);
  }
  if (o.hat) {
    pc.rect(5, 1, 7, 2, o.hat);
    if (facing === 'down') pc.rect(5, 3, 7, 1, o.hat);
    else if (side) pc.rect(facing === 'right' ? 9 : 3, 3, 4, 1, o.hat);
  }

  outline(pc, PALETTE.ink);
  return pc;
}
