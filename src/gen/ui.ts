import { PALETTE } from './palette';
import { PixelCanvas } from './pixels';

/**
 * A rounded window frame for dialogue boxes, menus and banners:
 * dark outline, light inner bevel, cream fill.
 */
export function drawFrame(w: number, h: number, fill: string = PALETTE.white): PixelCanvas {
  const pc = new PixelCanvas(w, h);
  pc.rect(1, 0, w - 2, h, PALETTE.ink);
  pc.rect(0, 1, w, h - 2, PALETTE.ink);
  pc.rect(1, 1, w - 2, h - 2, '#5a6a9a');
  pc.rect(2, 2, w - 4, h - 4, '#8fa2d8');
  pc.rect(3, 3, w - 6, h - 6, fill);
  // Soft shadow along the bottom inside edge.
  pc.rect(3, h - 4, w - 6, 1, PALETTE.cream);
  return pc;
}

/** A small down-pointing arrow shown when the player can advance text. */
export function drawAdvanceArrow(): PixelCanvas {
  const pc = new PixelCanvas(5, 3);
  pc.rect(0, 0, 5, 1, '#d9483b');
  pc.rect(1, 1, 3, 1, '#d9483b');
  pc.set(2, 2, '#d9483b');
  return pc;
}
