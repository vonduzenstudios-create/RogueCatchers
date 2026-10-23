import { Rng } from '../engine/rng';
import type { SpeciesId } from '../data/species';
import { hsl, ramp } from './color';
import { PixelCanvas, bayer, outline } from './pixels';

/**
 * Monster sprite generator.
 *
 * Each species is a recipe of simple shapes (ellipses, polygons, capsules)
 * tagged with a colour tone. Shapes are shaded per pixel as if they were
 * rounded 3D forms lit from the top left, dithered into a 4-step ramp,
 * outlined, and then given a face. The back view reuses the same recipe
 * without the face and with tails and wings brought to the front.
 */

export const MONSTER_SIZE = 64;

type Tone = 'main' | 'accent' | 'belly' | 'dark' | 'glow' | 'cheek';
type Point = [number, number];

type Shape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'poly'; pts: Point[] }
  | { kind: 'capsule'; x1: number; y1: number; x2: number; y2: number; r: number };

interface Part {
  shape: Shape;
  tone: Tone;
  /** Also draw a copy reflected across the sprite's centre line. */
  mirror?: boolean;
  /** Drawn behind the body from the front, in front of it from the back (tails, wings). */
  behind?: boolean;
  /** Only drawn in the front view (muzzles, bellies). */
  frontOnly?: boolean;
  pattern?: 'spots' | 'cracks' | 'stripes';
}

type EyeStyle = 'round' | 'sharp' | 'cyclops';

interface Face {
  eyes: { x: number; y: number; r: number; style: EyeStyle; mirror: boolean };
  mouth?: { x: number; y: number; w: number; style: 'smile' | 'fang' | 'line' | 'jaw' };
  nose?: Point;
  cheeks?: { x: number; y: number };
}

interface Recipe {
  /** Hue, saturation, lightness of the main body colour. */
  main: [number, number, number];
  accent: [number, number, number];
  belly: [number, number, number];
  parts: Part[];
  face: Face;
  /** Speckle the body like rough stone. */
  rough?: boolean;
}

// Small constructors keep the recipes readable.
const E = (cx: number, cy: number, rx: number, ry: number, tone: Tone, opts: Partial<Part> = {}): Part => ({
  shape: { kind: 'ellipse', cx, cy, rx, ry },
  tone,
  ...opts,
});
const P = (pts: Point[], tone: Tone, opts: Partial<Part> = {}): Part => ({ shape: { kind: 'poly', pts }, tone, ...opts });
const C = (x1: number, y1: number, x2: number, y2: number, r: number, tone: Tone, opts: Partial<Part> = {}): Part => ({
  shape: { kind: 'capsule', x1, y1, x2, y2, r },
  tone,
  ...opts,
});
const M = { mirror: true };

const RECIPES: Record<SpeciesId, Recipe> = {
  embrit: {
    main: [16, 0.78, 0.52],
    accent: [46, 0.95, 0.58],
    belly: [38, 0.6, 0.86],
    parts: [
      C(42, 52, 51, 36, 5, 'main', { behind: true }),
      E(52, 30, 5, 7, 'accent', { behind: true }),
      E(52, 27, 2, 3, 'glow', { behind: true }),
      E(26, 59, 4, 3, 'main', M),
      E(32, 48, 12, 12, 'main'),
      E(32, 51, 7, 8, 'belly', { frontOnly: true }),
      P([[21, 25], [18, 8], [29, 20]], 'main', M),
      P([[22, 22], [20, 13], [26, 20]], 'accent', { ...M, frontOnly: true }),
      E(32, 30, 12, 10, 'main'),
      E(32, 35, 6, 4, 'belly', { frontOnly: true }),
    ],
    face: {
      eyes: { x: 27, y: 29, r: 2.5, style: 'round', mirror: true },
      nose: [32, 33],
      mouth: { x: 32, y: 36, w: 4, style: 'smile' },
    },
  },
  splashell: {
    main: [200, 0.7, 0.58],
    accent: [158, 0.42, 0.34],
    belly: [48, 0.55, 0.8],
    parts: [
      E(19, 57, 5, 4, 'main', M),
      E(32, 45, 17, 13, 'accent', { pattern: 'spots' }),
      C(17, 43, 11, 48, 3, 'main', M),
      E(32, 50, 9, 6, 'belly', { frontOnly: true }),
      P([[32, 11], [27, 22], [37, 22]], 'main'),
      E(32, 30, 11, 10, 'main'),
    ],
    face: {
      eyes: { x: 28, y: 29, r: 3, style: 'round', mirror: true },
      mouth: { x: 32, y: 35, w: 5, style: 'smile' },
      cheeks: { x: 24, y: 34 },
    },
  },
  sproutle: {
    main: [128, 0.5, 0.45],
    accent: [86, 0.65, 0.5],
    belly: [56, 0.6, 0.8],
    parts: [
      C(40, 56, 52, 46, 4, 'main', { behind: true }),
      P([[50, 47], [58, 38], [55, 49]], 'accent', { behind: true }),
      E(26, 58, 4, 3, 'main', M),
      E(32, 47, 10, 11, 'main'),
      E(32, 49, 6, 8, 'belly', { frontOnly: true }),
      C(23, 44, 19, 50, 2.5, 'main', M),
      P([[24, 12], [24, 23], [30, 20]], 'accent', M),
      P([[32, 7], [27, 21], [37, 21]], 'accent'),
      E(32, 28, 11, 10, 'main'),
    ],
    face: {
      eyes: { x: 27, y: 28, r: 2.5, style: 'round', mirror: true },
      mouth: { x: 32, y: 33, w: 7, style: 'smile' },
    },
  },
  zapkit: {
    main: [50, 0.85, 0.58],
    accent: [24, 0.6, 0.42],
    belly: [48, 0.7, 0.85],
    parts: [
      P([[38, 54], [50, 48], [45, 44], [56, 34], [52, 45], [57, 48]], 'main', { behind: true }),
      C(28, 24, 24, 11, 1, 'dark', M),
      E(24, 10, 2, 2, 'glow', M),
      E(20, 21, 6, 8, 'main', M),
      E(20, 21, 3, 5, 'accent', { ...M, frontOnly: true }),
      E(26, 58, 4, 3, 'main', M),
      E(32, 48, 11, 11, 'main'),
      E(32, 50, 6, 7, 'belly', { frontOnly: true }),
      E(32, 32, 11, 9, 'main', { pattern: 'stripes' }),
    ],
    face: {
      eyes: { x: 27, y: 31, r: 2.5, style: 'round', mirror: true },
      nose: [32, 34],
      mouth: { x: 32, y: 36, w: 3, style: 'smile' },
      cheeks: { x: 23, y: 35 },
    },
  },
  puddlop: {
    main: [186, 0.55, 0.5],
    accent: [208, 0.75, 0.62],
    belly: [70, 0.45, 0.82],
    parts: [
      E(16, 57, 6, 4, 'main', M),
      E(23, 38, 6, 6, 'main', M),
      E(32, 50, 16, 10, 'main', { pattern: 'spots' }),
      E(32, 54, 10, 6, 'belly', { frontOnly: true }),
      C(24, 52, 22, 59, 2, 'main', M),
      P([[32, 22], [27, 33], [37, 33]], 'accent'),
      E(32, 35, 5, 5, 'accent'),
    ],
    face: {
      eyes: { x: 23, y: 37, r: 3.5, style: 'round', mirror: true },
      mouth: { x: 32, y: 47, w: 12, style: 'line' },
    },
  },
  brambun: {
    main: [96, 0.4, 0.5],
    accent: [24, 0.5, 0.35],
    belly: [60, 0.35, 0.86],
    parts: [
      E(44, 54, 4, 4, 'belly', { behind: true }),
      E(26, 14, 3.5, 11, 'main', M),
      E(26, 14, 1.5, 8, 'belly', { ...M, frontOnly: true }),
      P([[23, 9], [18, 7], [23, 13]], 'accent', M),
      P([[23, 17], [18, 17], [23, 21]], 'accent', M),
      E(25, 59, 5, 3, 'main', M),
      E(32, 49, 11, 11, 'main'),
      E(32, 51, 6, 7, 'belly', { frontOnly: true }),
      E(32, 32, 11, 9, 'main'),
    ],
    face: {
      eyes: { x: 27, y: 31, r: 2.5, style: 'round', mirror: true },
      nose: [32, 34],
      mouth: { x: 32, y: 36, w: 3, style: 'fang' },
    },
  },
  pebblet: {
    main: [32, 0.18, 0.5],
    accent: [26, 0.32, 0.38],
    belly: [36, 0.2, 0.7],
    rough: true,
    parts: [
      C(20, 50, 11, 57, 1.5, 'dark', M),
      C(20, 44, 10, 46, 1.5, 'dark', M),
      E(32, 42, 15, 13, 'main', { pattern: 'cracks' }),
      C(32, 30, 32, 52, 0.6, 'dark', { behind: true }),
      E(32, 52, 10, 7, 'accent'),
      P([[29, 50], [32, 34], [35, 50]], 'accent', { frontOnly: true }),
    ],
    face: {
      eyes: { x: 27, y: 53, r: 2.2, style: 'round', mirror: true },
    },
  },
  glimshade: {
    main: [272, 0.42, 0.36],
    accent: [305, 0.85, 0.65],
    belly: [270, 0.35, 0.55],
    parts: [
      P([[26, 21], [28, 9], [32, 19]], 'main'),
      P([[32, 19], [37, 7], [39, 21]], 'main'),
      C(20, 34, 13, 41, 2, 'main', M),
      P([[20, 36], [44, 36], [41, 54], [36, 47], [32, 58], [28, 47], [23, 54]], 'main'),
      E(32, 32, 13, 14, 'main'),
      E(32, 36, 7, 7, 'belly', { frontOnly: true }),
    ],
    face: {
      eyes: { x: 32, y: 30, r: 5, style: 'cyclops', mirror: false },
      mouth: { x: 32, y: 39, w: 5, style: 'fang' },
    },
  },
  cragmaw: {
    main: [26, 0.16, 0.46],
    accent: [18, 0.3, 0.32],
    belly: [42, 0.3, 0.86],
    rough: true,
    parts: [
      C(13, 40, 8, 53, 4, 'main', M),
      E(22, 59, 6, 4, 'main', M),
      E(32, 37, 22, 20, 'main', { pattern: 'cracks' }),
      E(32, 51, 16, 8, 'main'),
      E(32, 45, 14, 6, 'dark', { frontOnly: true }),
      P([[21, 40], [24, 40], [22.5, 44]], 'belly', { ...M, frontOnly: true }),
      P([[26, 40], [29, 40], [27.5, 45]], 'belly', { ...M, frontOnly: true }),
      P([[25, 50], [28, 50], [26.5, 46]], 'belly', { ...M, frontOnly: true }),
      C(20, 29, 28, 32, 2, 'accent', { ...M, frontOnly: true }),
    ],
    face: {
      eyes: { x: 26, y: 34, r: 2, style: 'sharp', mirror: true },
    },
  },
};

export interface MonsterSprites {
  /** Two idle frames each, 64x64. */
  front: PixelCanvas[];
  back: PixelCanvas[];
}

export function generateMonster(id: SpeciesId): MonsterSprites {
  const recipe = RECIPES[id];
  const front = render(recipe, 'front', new Rng(`monster-${id}`));
  const back = render(recipe, 'back', new Rng(`monster-${id}`));
  return { front: [front, squash(front)], back: [back, squash(back)] };
}

type View = 'front' | 'back';

/** One flat list of parts to draw, in order, with mirrored copies expanded. */
function partsFor(recipe: Recipe, view: View): Part[] {
  const visible = recipe.parts.filter((p) => view === 'front' || !p.frontOnly);
  const behind = visible.filter((p) => p.behind);
  const rest = visible.filter((p) => !p.behind);
  const ordered = view === 'front' ? [...behind, ...rest] : [...rest, ...behind];
  return ordered.flatMap((p) => (p.mirror ? [p, mirrorPart(p)] : [p]));
}

const mx = (x: number) => MONSTER_SIZE - 1 - x;

function mirrorPart(p: Part): Part {
  const s = p.shape;
  const shape: Shape =
    s.kind === 'ellipse'
      ? { ...s, cx: mx(s.cx) }
      : s.kind === 'poly'
        ? { kind: 'poly', pts: s.pts.map(([x, y]) => [mx(x), y] as Point) }
        : { ...s, x1: mx(s.x1), x2: mx(s.x2) };
  return { ...p, shape, mirror: false };
}

function render(recipe: Recipe, view: View, rng: Rng): PixelCanvas {
  const pc = new PixelCanvas(MONSTER_SIZE, MONSTER_SIZE);
  const ramps: Record<Tone, string[]> = {
    main: ramp(...recipe.main),
    accent: ramp(...recipe.accent),
    belly: ramp(...recipe.belly),
    dark: ramp(recipe.main[0], 0.35, 0.2),
    glow: ramp(recipe.accent[0], 0.9, 0.72),
    cheek: ramp(350, 0.7, 0.68),
  };
  const parts = partsFor(recipe, view);
  // From behind, the light still comes from the top left of the screen,
  // but the back is slightly darker overall.
  const bias = view === 'back' ? -0.08 : 0;

  for (const part of parts) {
    const tones = ramps[part.tone];
    const box = bounds(part.shape);
    const patternRng = rng.fork(`pattern-${part.tone}`);
    const spots = part.pattern === 'spots' ? scatter(patternRng, box, 5) : [];
    const cracks = part.pattern === 'cracks' ? crackLines(patternRng, box) : [];

    for (let y = Math.floor(box.y0); y <= Math.ceil(box.y1); y++) {
      for (let x = Math.floor(box.x0); x <= Math.ceil(box.x1); x++) {
        const n = normalAt(part.shape, x + 0.5, y + 0.5);
        if (!n) continue;
        const nz = Math.sqrt(Math.max(0, 1 - n[0] * n[0] - n[1] * n[1]));
        // Light from the top left and slightly in front.
        let light = -0.5 * n[0] - 0.62 * n[1] + 0.6 * nz + bias;
        light += (bayer(x, y) - 0.5) * 0.18;
        let shade = light < 0.12 ? 0 : light < 0.55 ? 1 : light < 0.86 ? 2 : 3;

        if (spots.some(([sx, sy, r]) => (x - sx) ** 2 + (y - sy) ** 2 <= r * r)) shade = Math.max(0, shade - 1);
        if (part.pattern === 'stripes' && y < box.y0 + (box.y1 - box.y0) * 0.35 && Math.abs(x - (box.x0 + box.x1) / 2) % 6 < 2) shade = 0;
        if (cracks.some((c) => onCrack(c, x, y))) {
          pc.set(x, y, ramps.dark[1]);
          continue;
        }
        if (recipe.rough && patternRng.chance(0.06)) shade = Math.max(0, shade - 1);
        pc.set(x, y, tones[shade]);
      }
    }
  }

  outline(pc, hsl(recipe.main[0], 0.45, 0.1));
  if (view === 'front') drawFace(pc, recipe.face, ramps);
  return pc;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function bounds(s: Shape): Box {
  if (s.kind === 'ellipse') return { x0: s.cx - s.rx, y0: s.cy - s.ry, x1: s.cx + s.rx, y1: s.cy + s.ry };
  if (s.kind === 'capsule') {
    return {
      x0: Math.min(s.x1, s.x2) - s.r,
      y0: Math.min(s.y1, s.y2) - s.r,
      x1: Math.max(s.x1, s.x2) + s.r,
      y1: Math.max(s.y1, s.y2) + s.r,
    };
  }
  const xs = s.pts.map((p) => p[0]);
  const ys = s.pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/**
 * If (x, y) is inside the shape, return an approximate surface normal
 * (x and y components in -1..1) for shading, otherwise null.
 */
function normalAt(s: Shape, x: number, y: number): Point | null {
  if (s.kind === 'ellipse') {
    const nx = (x - s.cx) / s.rx;
    const ny = (y - s.cy) / s.ry;
    return nx * nx + ny * ny <= 1 ? [nx, ny] : null;
  }
  if (s.kind === 'capsule') {
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / len2));
    const ox = x - (s.x1 + t * dx);
    const oy = y - (s.y1 + t * dy);
    if (ox * ox + oy * oy > s.r * s.r) return null;
    return [ox / s.r, oy / s.r];
  }
  if (!insidePoly(s.pts, x, y)) return null;
  const b = bounds(s);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const nx = ((x - cx) / ((b.x1 - b.x0) / 2 || 1)) * 0.8;
  const ny = ((y - cy) / ((b.y1 - b.y0) / 2 || 1)) * 0.8;
  return [nx, ny];
}

function insidePoly(pts: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function scatter(rng: Rng, box: Box, count: number): [number, number, number][] {
  return Array.from({ length: count }, () => [
    rng.range(box.x0 + 3, box.x1 - 3),
    rng.range(box.y0 + 2, box.y1 - 3),
    rng.range(1.5, 3),
  ]);
}

interface Crack {
  pts: Point[];
}

/** A few short jagged lines across a stony surface. */
function crackLines(rng: Rng, box: Box): Crack[] {
  return Array.from({ length: 3 }, () => {
    let x = rng.range(box.x0 + 4, box.x1 - 4);
    let y = rng.range(box.y0 + 3, box.y1 - 6);
    const pts: Point[] = [[Math.round(x), Math.round(y)]];
    for (let i = 0; i < 4; i++) {
      x += rng.int(-1, 1);
      y += 1;
      pts.push([Math.round(x), Math.round(y)]);
    }
    return { pts };
  });
}

function onCrack(c: Crack, x: number, y: number): boolean {
  return c.pts.some(([cx, cy]) => cx === x && cy === y);
}

function drawFace(pc: PixelCanvas, face: Face, ramps: Record<Tone, string[]>): void {
  const ink = '#1a1020';
  const white = '#fbf8f0';
  const { eyes } = face;
  const eyeXs = eyes.mirror ? [eyes.x, mx(eyes.x)] : [eyes.x];

  for (const ex of eyeXs) {
    const left = ex < MONSTER_SIZE / 2;
    if (eyes.style === 'round') {
      const r = eyes.r;
      fillEllipse(pc, ex, eyes.y, r, r * 1.25, ink);
      fillEllipse(pc, ex + (left ? 0.5 : -0.5), eyes.y + 0.5, r * 0.55, r * 0.7, '#2b2140');
      pc.set(Math.round(ex - r * 0.4), Math.round(eyes.y - r * 0.5), white);
      pc.set(Math.round(ex - r * 0.4) + 1, Math.round(eyes.y - r * 0.5), white);
      pc.set(Math.round(ex - r * 0.4), Math.round(eyes.y - r * 0.5) + 1, white);
    } else if (eyes.style === 'sharp') {
      // Angled angry eye: a slanted bar with a glint.
      const dir = left ? 1 : -1;
      const len = Math.max(3, Math.round(eyes.r * 2));
      for (let i = 0; i < len; i++) {
        const px = Math.round(ex - dir * (len / 2) + dir * i);
        const py = Math.round(eyes.y + i * 0.4);
        pc.set(px, py, ink);
        pc.set(px, py + 1, ink);
      }
      pc.set(Math.round(ex), Math.round(eyes.y + 0.5), '#ffe08a');
    } else {
      const r = eyes.r;
      fillEllipse(pc, ex, eyes.y, r + 1, r, ink);
      fillEllipse(pc, ex, eyes.y, r, r - 1, white);
      fillEllipse(pc, ex, eyes.y + 0.5, r * 0.6, r * 0.6, ramps.glow[1]);
      fillEllipse(pc, ex, eyes.y + 0.5, r * 0.3, r * 0.45, ink);
      pc.set(Math.round(ex - r * 0.45), Math.round(eyes.y - r * 0.4), white);
    }
  }

  if (face.cheeks) {
    for (const cx of [face.cheeks.x, mx(face.cheeks.x)]) {
      pc.rect(Math.round(cx) - 1, face.cheeks.y, 3, 1, ramps.cheek[1]);
    }
  }

  if (face.nose) pc.rect(face.nose[0] - 1, face.nose[1], 2, 1, ink);

  const m = face.mouth;
  if (!m) return;
  const half = Math.floor(m.w / 2);
  if (m.style === 'line') {
    pc.rect(m.x - half, m.y, m.w, 1, ink);
    pc.set(m.x - half - 1, m.y - 1, ink);
    pc.set(m.x + half, m.y - 1, ink);
  } else if (m.style === 'smile') {
    pc.rect(m.x - half + 1, m.y + 1, Math.max(1, m.w - 2), 1, ink);
    pc.set(m.x - half, m.y, ink);
    pc.set(m.x + half - (m.w % 2 === 0 ? 1 : 0), m.y, ink);
  } else if (m.style === 'fang') {
    pc.rect(m.x - half, m.y, m.w, 1, ink);
    pc.set(m.x - half + 1, m.y + 1, white);
    pc.set(m.x + half - 1, m.y + 1, white);
  } else {
    pc.rect(m.x - half, m.y, m.w, 2, ink);
  }
}

function fillEllipse(pc: PixelCanvas, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) pc.set(x, y, color);
    }
  }
}

/** Second idle frame: the upper body dips one pixel while the feet stay planted. */
function squash(src: PixelCanvas): PixelCanvas {
  const out = new PixelCanvas(src.width, src.height);
  const feet = src.height - 8;
  out.ctx.drawImage(src.canvas, 0, feet, src.width, 8, 0, feet, src.width, 8);
  out.ctx.drawImage(src.canvas, 0, 0, src.width, feet, 0, 1, src.width, feet);
  return out;
}
