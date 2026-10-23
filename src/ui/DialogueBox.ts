import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../engine/Game';
import type { Input } from '../engine/Input';
import { GLYPH_H, measureText, textSprite } from '../gen/font';
import { PALETTE } from '../gen/palette';
import { drawAdvanceArrow, drawFrame } from '../gen/ui';
import { wrapText } from './text';

const BOX_W = VIEW_WIDTH - 8;
const BOX_H = 46;
const PAD_X = 10;
const LINE_H = 11;
const LINES_PER_PAGE = 3;
const CHARS_PER_SECOND = 45;
const CHAR_W = 6;

/**
 * Bottom-of-screen text box with a typewriter effect. Confirm finishes
 * the current page, or moves to the next one once it's fully shown.
 */
export class DialogueBox {
  readonly root = new Container();
  private textLayer = new Container();
  private mask = new Graphics();
  private arrow: Sprite;
  private nameTag: Sprite | null = null;
  private pages: string[][] = [];
  private page = 0;
  private revealed = 0;
  private time = 0;
  private onDone: (() => void) | null = null;
  private frameTexture: Texture;

  constructor() {
    this.frameTexture = drawFrame(BOX_W, BOX_H).toTexture();
    const frame = new Sprite(this.frameTexture);
    this.root.addChild(frame);
    this.root.addChild(this.textLayer);
    this.root.addChild(this.mask);
    this.textLayer.mask = this.mask;
    this.arrow = new Sprite(drawAdvanceArrow().toTexture());
    this.arrow.position.set(BOX_W - 14, BOX_H - 9);
    this.root.addChild(this.arrow);
    this.root.position.set(4, VIEW_HEIGHT - BOX_H - 4);
    this.root.visible = false;
  }

  get active(): boolean {
    return this.root.visible;
  }

  /** Show a conversation. Each entry is a paragraph; long ones span several pages. */
  show(paragraphs: string[], speaker?: string, onDone?: () => void): void {
    this.pages = [];
    for (const p of paragraphs) {
      const lines = wrapText(p, BOX_W - PAD_X * 2);
      for (let i = 0; i < lines.length; i += LINES_PER_PAGE) this.pages.push(lines.slice(i, i + LINES_PER_PAGE));
    }
    this.onDone = onDone ?? null;
    this.setSpeaker(speaker);
    this.page = 0;
    this.root.visible = true;
    this.renderPage();
  }

  update(dt: number, input: Input): void {
    if (!this.active) return;
    this.time += dt;
    const total = this.pageLength();
    const done = this.revealed >= total;
    if (input.wasPressed('confirm') || input.wasPressed('cancel')) {
      if (!done) {
        this.revealed = total;
      } else if (this.page < this.pages.length - 1) {
        this.page++;
        this.renderPage();
        return;
      } else {
        this.root.visible = false;
        this.setSpeaker(undefined);
        const callback = this.onDone;
        this.onDone = null;
        callback?.();
        return;
      }
    } else if (!done) {
      this.revealed = Math.min(total, this.revealed + dt * CHARS_PER_SECOND);
    }
    this.updateMask();
    this.arrow.visible = this.revealed >= total && Math.floor(this.time * 3) % 2 === 0;
  }

  private pageLength(): number {
    return this.pages[this.page].reduce((n, line) => n + line.length, 0);
  }

  private renderPage(): void {
    for (const child of this.textLayer.removeChildren()) child.destroy({ texture: true, textureSource: true });
    this.pages[this.page].forEach((line, i) => {
      const s = textSprite(line, { color: PALETTE.ink });
      s.position.set(PAD_X, 7 + i * LINE_H);
      this.textLayer.addChild(s);
    });
    this.revealed = 0;
    this.updateMask();
  }

  /** Reveal text line by line, character by character. */
  private updateMask(): void {
    this.mask.clear();
    let remaining = Math.floor(this.revealed);
    this.pages[this.page].forEach((line, i) => {
      const chars = Math.min(line.length, remaining);
      remaining -= chars;
      if (chars > 0) this.mask.rect(PAD_X, 7 + i * LINE_H, chars * CHAR_W, GLYPH_H + 1).fill(0xffffff);
    });
  }

  private setSpeaker(name: string | undefined): void {
    if (this.nameTag) {
      this.nameTag.destroy({ texture: true, textureSource: true });
      this.nameTag = null;
    }
    if (!name) return;
    const w = measureText(name) + 12;
    const frame = drawFrame(w, 13, PALETTE.cream);
    const tag = new Sprite(frame.toTexture());
    const label = textSprite(name, { color: PALETTE.ink });
    label.position.set(6, 3);
    tag.addChild(label);
    tag.position.set(6, -10);
    this.nameTag = tag;
    this.root.addChild(tag);
  }
}
