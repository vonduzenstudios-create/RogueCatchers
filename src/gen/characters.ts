import { Texture } from 'pixi.js';
import { PALETTE } from './palette';
import { PixelCanvas, outline } from './pixels';

export type Facing = 'down' | 'up' | 'left' | 'right';

export interface Outfit {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
}

export const PLAYER_OUTFIT: Outfit = {
  skin: '#f1c39b',
  hair: '#3b2a4a',
  shirt: '#d9483b',
  pants: '#2f4a7a',
};

/**
 * Paper-doll character generator: builds a 16x16 sprite for each facing
 * with a 2-frame walk cycle (frame 0 = standing, 1 = stepping).
 */
export function generateCharacter(outfit: Outfit): Record<Facing, Texture[]> {
  const frames = (facing: Facing) => [0, 1].map((step) => drawCharacter(outfit, facing, step).toTexture());
  return { down: frames('down'), up: frames('up'), left: frames('left'), right: frames('right') };
}

function drawCharacter(o: Outfit, facing: Facing, step: number): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  const side = facing === 'left' || facing === 'right';

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

  // Body and arms.
  pc.rect(5, 8, 6, 5, o.shirt);
  if (!side) {
    pc.rect(4, 9, 1, 3, o.skin);
    pc.rect(11, 9, 1, 3, o.skin);
  }

  // Head.
  pc.disc(8, 5, 3, o.skin);
  if (facing === 'up') {
    pc.disc(8, 5, 3, o.hair);
  } else {
    pc.rect(5, 2, 7, 2, o.hair);
    pc.set(5, 4, o.hair);
    pc.set(11, 4, o.hair);
    if (facing === 'down') {
      pc.set(7, 5, PALETTE.ink);
      pc.set(9, 5, PALETTE.ink);
    } else {
      // Side view: hair at the back, one eye at the front.
      const back = facing === 'right' ? 5 : 10;
      pc.rect(back, 3, 2, 3, o.hair);
      pc.set(facing === 'right' ? 10 : 6, 5, PALETTE.ink);
    }
  }

  outline(pc, PALETTE.ink);
  return pc;
}
