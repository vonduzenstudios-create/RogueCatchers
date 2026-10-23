import { Texture } from 'pixi.js';

/** A tiny RGBA pixel buffer that generators draw into before it becomes a texture. */
export class PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
  }

  set(x: number, y: number, color: string): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
  }

  /** Filled circle with hard pixel edges. */
  disc(cx: number, cy: number, r: number, color: string): void {
    this.ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r + r * 0.6) this.ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  toTexture(): Texture {
    const texture = Texture.from(this.canvas);
    texture.source.scaleMode = 'nearest';
    return texture;
  }
}

/** 4x4 ordered (Bayer) dither threshold in [0, 1), for retro gradients. */
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number {
  return BAYER_4[(y & 3) * 4 + (x & 3)] / 16;
}

/** Draw a 1-pixel outline around every opaque pixel, on transparent neighbours only. */
export function outline(target: PixelCanvas, color: string): void {
  const { width, height, ctx } = target;
  const alpha = ctx.getImageData(0, 0, width, height).data;
  const opaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && alpha[(y * width + x) * 4 + 3] > 0;
  const edge: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (opaque(x, y)) continue;
      if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) edge.push([x, y]);
    }
  }
  for (const [x, y] of edge) target.set(x, y, color);
}
