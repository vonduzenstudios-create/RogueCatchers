import { Sprite } from 'pixi.js';
import { PixelCanvas } from './pixels';

/**
 * Hand-coded 5x7 bitmap font. Each glyph is seven rows of five bits.
 * Lowercase letters render as uppercase, like classic handheld games.
 */
const GLYPHS: Record<string, string> = {
  A: '01110 10001 10001 11111 10001 10001 10001',
  B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111',
  F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111',
  H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110',
  J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001',
  L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 10001 11001 10101 10011 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101',
  R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010',
  X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100',
  Z: '11111 00001 00010 00100 01000 10000 11111',
  '0': '01110 10001 10011 10101 11001 10001 01110',
  '1': '00100 01100 00100 00100 00100 00100 01110',
  '2': '01110 10001 00001 00010 00100 01000 11111',
  '3': '11111 00010 00100 00010 00001 10001 01110',
  '4': '00010 00110 01010 10010 11111 00010 00010',
  '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110',
  '7': '11111 00001 00010 00100 01000 01000 01000',
  '8': '01110 10001 10001 01110 10001 10001 01110',
  '9': '01110 10001 10001 01111 00001 00010 01100',
  ' ': '00000 00000 00000 00000 00000 00000 00000',
  '.': '00000 00000 00000 00000 00000 01100 01100',
  ',': '00000 00000 00000 00000 01100 00100 01000',
  '!': '00100 00100 00100 00100 00100 00000 00100',
  '?': '01110 10001 00001 00010 00100 00000 00100',
  '-': '00000 00000 00000 11111 00000 00000 00000',
  "'": '00100 00100 01000 00000 00000 00000 00000',
  ':': '00000 01100 01100 00000 01100 01100 00000',
  '/': '00001 00001 00010 00100 01000 10000 10000',
  '>': '01000 00100 00010 00001 00010 00100 01000',
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
const ADVANCE = GLYPH_W + 1;

const parsed = new Map<string, boolean[][]>(
  Object.entries(GLYPHS).map(([ch, rows]) => [
    ch,
    rows.split(' ').map((row) => [...row].map((bit) => bit === '1')),
  ]),
);

export function hasGlyph(ch: string): boolean {
  return parsed.has(ch.toUpperCase());
}

/** Width in pixels of `text` at scale 1. */
export function measureText(text: string): number {
  return text.length === 0 ? 0 : text.length * ADVANCE - 1;
}

/** Draw text into a pixel canvas. Unknown characters render as '?'. */
export function drawText(
  target: PixelCanvas,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 1,
): void {
  let cursor = x;
  for (const raw of text) {
    const glyph = parsed.get(raw.toUpperCase()) ?? parsed.get('?')!;
    for (let gy = 0; gy < GLYPH_H; gy++) {
      for (let gx = 0; gx < GLYPH_W; gx++) {
        if (glyph[gy][gx]) target.rect(cursor + gx * scale, y + gy * scale, scale, scale, color);
      }
    }
    cursor += ADVANCE * scale;
  }
}

export interface TextStyle {
  color: string;
  scale?: number;
  /** Colour of a 1-pixel outline drawn around every glyph. */
  outline?: string;
  /** Colour of a drop shadow one pixel down and right. */
  shadow?: string;
}

/** Render a line of text as a sprite. */
export function textSprite(text: string, style: TextStyle): Sprite {
  const scale = style.scale ?? 1;
  const pad = style.outline ? 1 : 0;
  const shadow = style.shadow ? scale : 0;
  const width = measureText(text) * scale + pad * 2 + shadow;
  const height = GLYPH_H * scale + pad * 2 + shadow;
  const canvas = new PixelCanvas(Math.max(1, width), height);
  if (style.shadow) drawText(canvas, text, pad + shadow, pad + shadow, style.shadow, scale);
  if (style.outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      drawText(canvas, text, pad + dx, pad + dy, style.outline, scale);
    }
  }
  drawText(canvas, text, pad, pad, style.color, scale);
  return new Sprite(canvas.toTexture());
}
