import { Rng } from '../engine/rng';
import { ramp } from './color';
import { drawText, measureText } from './font';
import { PALETTE } from './palette';
import { PixelCanvas, bayer, outline } from './pixels';
import { TILE } from './tiles';

export type BuildingKind = 'house' | 'lab' | 'hospital' | 'market' | 'gym';

export interface Building {
  canvas: PixelCanvas;
  /** Footprint in tiles; every tile of it is solid except the door. */
  widthTiles: number;
  heightTiles: number;
  /** Door column, in tiles from the building's left edge (on the bottom row). */
  doorTile: number;
}

interface Style {
  w: number;
  h: number;
  /** Roof hue, saturation, lightness. */
  roof: [number, number, number];
  wall: [number, number, number];
  sign?: string;
  awning?: boolean;
  emblem?: 'heart' | 'badge';
}

const STYLES: Record<Exclude<BuildingKind, 'house'>, Style> = {
  lab: { w: 6, h: 4, roof: [212, 0.25, 0.45], wall: [40, 0.2, 0.86], sign: 'LAB' },
  hospital: { w: 5, h: 4, roof: [352, 0.6, 0.55], wall: [30, 0.3, 0.9], sign: 'HOSPITAL', emblem: 'heart' },
  market: { w: 5, h: 4, roof: [205, 0.6, 0.48], wall: [40, 0.35, 0.82], sign: 'MARKET', awning: true },
  gym: { w: 6, h: 4, roof: [24, 0.12, 0.42], wall: [30, 0.15, 0.68], sign: 'GYM', emblem: 'badge' },
};

/** Draw a building from code: shingled roof, plank walls, windows, a door and a sign. */
export function drawBuilding(kind: BuildingKind, seed = kind): Building {
  const rng = new Rng(`building-${seed}`);
  const style: Style =
    kind === 'house'
      ? { w: 4, h: 3, roof: [rng.pick([4, 150, 212, 280]), 0.5, 0.48], wall: [36, 0.3, 0.82] }
      : STYLES[kind];

  const W = style.w * TILE;
  const H = style.h * TILE;
  const pc = new PixelCanvas(W, H);
  const roofC = ramp(...style.roof);
  const wallC = ramp(...style.wall);
  const roofH = Math.round(H * 0.45);
  const inset = 2;

  // Walls with horizontal planks.
  for (let y = roofH - 2; y < H - 3; y++) {
    const plank = (y - roofH) % 4 === 3;
    pc.rect(inset, y, W - inset * 2, 1, plank ? wallC[0] : wallC[1]);
  }
  pc.rect(inset, roofH - 1, W - inset * 2, 2, wallC[0]);
  // Stone foundation.
  for (let y = H - 3; y < H - 1; y++) {
    for (let x = inset; x < W - inset; x++) {
      const brick = (x + (y % 2) * 3) % 6 === 0;
      pc.set(x, y, brick ? '#5a5560' : '#8a8590');
    }
  }

  // Roof: shingle rows that get lighter toward the ridge.
  for (let y = 1; y < roofH; y++) {
    const t = y / roofH;
    for (let x = 0; x < W; x++) {
      const row = Math.floor(y / 3);
      const gap = (x + row * 3) % 6 === 0 && y % 3 !== 0;
      let shade = t < 0.25 ? 2 : 1;
      if (y % 3 === 0 || gap) shade = 0;
      if (t < 0.12 && bayer(x, y) > 0.5) shade = 3;
      pc.set(x, y, roofC[shade]);
    }
  }
  pc.rect(0, 0, W, 1, roofC[3]);
  pc.rect(0, roofH - 1, W, 1, roofC[0]);

  // Door on a tile column near the middle.
  const doorTile = Math.floor(style.w / 2);
  const doorX = doorTile * TILE + 2;
  const doorY = H - 3 - 13;
  pc.rect(doorX - 1, doorY - 1, 14, 14, '#4a2e18');
  pc.rect(doorX, doorY, 12, 13, '#8a5a32');
  pc.rect(doorX + 1, doorY + 1, 4, 11, '#a06a3a');
  pc.rect(doorX + 7, doorY + 1, 4, 11, '#a06a3a');
  pc.set(doorX + 9, doorY + 7, '#f2d15c');

  // Windows on both sides of the door, avoiding it.
  const winY = roofH + 3;
  for (let tx = 0; tx < style.w; tx++) {
    if (tx === doorTile) continue;
    drawWindow(pc, tx * TILE + 3, winY);
  }

  if (style.awning) {
    const ay = doorY - 6;
    for (let x = doorX - 6; x < doorX + 18; x++) {
      const stripe = Math.floor((x - doorX) / 3) % 2 === 0;
      pc.rect(x, ay, 1, 4, stripe ? '#f4f1e8' : '#d9483b');
      pc.set(x, ay + 4 + (x % 2), stripe ? '#d9d2c3' : '#a8322a');
    }
  }

  if (style.sign) drawSign(pc, style.sign, W, roofH, roofC);
  if (style.emblem === 'heart') drawHeart(pc, Math.floor(W / 2), 3);
  if (style.emblem === 'badge') drawBadge(pc, Math.floor(W / 2), 2);

  outline(pc, PALETTE.ink);
  return { canvas: pc, widthTiles: style.w, heightTiles: style.h, doorTile };
}

function drawWindow(pc: PixelCanvas, x: number, y: number): void {
  pc.rect(x - 1, y - 1, 12, 10, '#4a2e18');
  for (let wy = 0; wy < 8; wy++) {
    for (let wx = 0; wx < 10; wx++) {
      const glint = wx - wy === 2 || wx - wy === 3;
      pc.set(x + wx, y + wy, glint ? '#e8f6ff' : wy < 4 ? '#8fc2ff' : '#5f9ad8');
    }
  }
  pc.rect(x + 4, y, 2, 8, '#4a2e18');
  pc.rect(x, y + 3, 10, 1, '#4a2e18');
  pc.rect(x - 1, y + 9, 12, 1, '#c99a62');
}

function drawSign(pc: PixelCanvas, text: string, W: number, roofH: number, roofC: string[]): void {
  const tw = measureText(text);
  const sw = tw + 6;
  const sx = Math.floor((W - sw) / 2);
  const sy = roofH - 6;
  pc.rect(sx - 1, sy - 1, sw + 2, 11, '#2a1e1a');
  pc.rect(sx, sy, sw, 9, roofC[0]);
  drawText(pc, text, sx + 3, sy + 1, PALETTE.white);
}

function drawHeart(pc: PixelCanvas, cx: number, y: number): void {
  const rows = ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000'];
  rows.forEach((row, dy) =>
    [...row].forEach((bit, dx) => {
      if (bit === '1') pc.set(cx - 4 + dx, y + dy, dy === 1 && dx === 1 ? '#ffd0dc' : '#f4f1e8');
    }),
  );
}

function drawBadge(pc: PixelCanvas, cx: number, y: number): void {
  pc.disc(cx, y + 4, 4, '#f2c230');
  pc.disc(cx, y + 4, 2, '#c08a3a');
  pc.set(cx - 1, y + 2, '#fff3b0');
}
