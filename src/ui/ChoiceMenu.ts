import { Container, Sprite } from 'pixi.js';
import { audio } from '../audio';
import type { Input } from '../engine/Input';
import { textSprite } from '../gen/font';
import { PALETTE } from '../gen/palette';
import { drawFrame } from '../gen/ui';

export interface Choice {
  label: string;
  enabled?: boolean;
  onPick: () => void;
}

/**
 * A vertical list of choices in a window, driven by keyboard or mouse.
 * Cancel calls `onCancel` (if given) and closes the menu.
 */
export class ChoiceMenu {
  readonly root = new Container();
  private cursor = 0;
  private choices: Choice[] = [];
  private onCancel: (() => void) | null = null;
  private width = 0;

  get active(): boolean {
    return this.root.visible && this.choices.length > 0;
  }

  open(choices: Choice[], x: number, y: number, onCancel?: () => void): void {
    this.choices = choices;
    this.onCancel = onCancel ?? null;
    this.cursor = Math.max(0, choices.findIndex((c) => c.enabled !== false));
    this.width = Math.max(...choices.map((c) => c.label.length)) * 6 + 28;
    this.root.position.set(x, y);
    this.root.visible = true;
    this.render();
  }

  close(): void {
    this.choices = [];
    this.root.visible = false;
    for (const c of this.root.removeChildren()) c.destroy({ children: true, texture: true, textureSource: true });
  }

  /** Width and height of the window in pixels, for positioning. */
  get size(): { w: number; h: number } {
    return { w: this.width, h: this.choices.length * 12 + 12 };
  }

  update(input: Input): void {
    if (!this.active) return;
    const n = this.choices.length;
    if (input.wasPressed('up')) this.move(-1, n);
    if (input.wasPressed('down')) this.move(1, n);
    if (input.wasPressed('confirm')) this.pick(this.cursor);
    else if (input.wasPressed('cancel') && this.onCancel) {
      audio.sfx('cancel');
      const cancel = this.onCancel;
      this.close();
      cancel();
    }
  }

  private move(delta: number, n: number): void {
    this.cursor = (this.cursor + delta + n) % n;
    audio.sfx('cursor');
    this.render();
  }

  private pick(i: number): void {
    const choice = this.choices[i];
    if (!choice || choice.enabled === false) return;
    audio.sfx('confirm');
    this.close();
    choice.onPick();
  }

  private render(): void {
    for (const c of this.root.removeChildren()) c.destroy({ children: true, texture: true, textureSource: true });
    const { w, h } = this.size;
    const box = new Sprite(drawFrame(w, h).toTexture());
    this.root.addChild(box);
    this.choices.forEach((choice, i) => {
      const row = new Container();
      row.position.set(8, 7 + i * 12);
      const label = textSprite(choice.label, { color: choice.enabled === false ? '#9a95a0' : PALETTE.ink });
      label.x = 8;
      row.addChild(label);
      if (i === this.cursor) row.addChild(textSprite('>', { color: '#d9483b' }));
      row.eventMode = 'static';
      row.cursor = 'pointer';
      row.hitArea = { contains: (px: number, py: number) => px >= 0 && px < w - 16 && py >= -2 && py < 10 };
      row.on('pointertap', () => this.pick(i));
      this.root.addChild(row);
    });
  }
}
