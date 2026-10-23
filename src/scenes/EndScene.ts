import { Sprite } from 'pixi.js';
import { audio } from '../audio';
import type { Game } from '../engine/Game';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../engine/Game';
import { Scene } from '../engine/Scene';
import { textSprite } from '../gen/font';
import { PALETTE } from '../gen/palette';
import { drawBadge, titleBackdrop } from '../gen/title';
import { drawFrame } from '../gen/ui';

/** "m:ss" or "h:mm:ss". */
export function formatPlayTime(seconds: number): string {
  const s = Math.floor(seconds);
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/** The end of the demo: the badge, a few stats, then back to the world. */
export class EndScene extends Scene {
  private time = 0;
  private badge!: Sprite;
  private prompt!: Sprite;

  constructor(
    game: Game,
    private onClose: () => void,
  ) {
    super(game);
  }

  enter(): void {
    audio.music('title');
    this.root.addChild(new Sprite(titleBackdrop(VIEW_WIDTH, VIEW_HEIGHT, 'ending')));
    const center = (s: Sprite, y: number) => {
      s.position.set(Math.floor((VIEW_WIDTH - s.width) / 2), y);
      this.root.addChild(s);
    };
    center(
      textSprite('Congratulations!', { color: PALETTE.title, scale: 2, outline: PALETTE.titleOutline, shadow: PALETTE.titleShade }),
      10,
    );
    center(textSprite('You earned the Basalt Badge!', { color: PALETTE.cream, shadow: PALETTE.ink }), 34);

    this.badge = new Sprite(drawBadge(24).toTexture());
    this.badge.anchor.set(0.5);
    this.badge.position.set(VIEW_WIDTH / 2, 60);
    this.root.addChild(this.badge);

    const st = this.game.state.stats;
    const rows: [string, string][] = [
      ['Play time', formatPlayTime(st.playSeconds)],
      ['Monsters caught', String(st.caught)],
      ['Species seen', String(st.seen.length)],
      ['Battles won', String(st.battlesWon)],
      ['Coins', String(this.game.state.coins)],
    ];
    const w = 160;
    const box = new Sprite(drawFrame(w, rows.length * 11 + 12).toTexture());
    box.position.set(Math.floor((VIEW_WIDTH - w) / 2), 78);
    rows.forEach(([label, value], i) => {
      const l = textSprite(label, { color: PALETTE.ink });
      l.position.set(10, 7 + i * 11);
      const v = textSprite(value, { color: PALETTE.ink });
      v.position.set(w - 10 - v.width, 7 + i * 11);
      box.addChild(l, v);
    });
    this.root.addChild(box);

    this.prompt = textSprite('Thanks for playing! Enter to keep exploring', { color: PALETTE.white, outline: PALETTE.ink });
    center(this.prompt, VIEW_HEIGHT - 14);
  }

  update(dt: number): void {
    this.time += dt;
    this.badge.rotation = Math.sin(this.time * 2) * 0.12;
    this.badge.scale.set(1 + Math.sin(this.time * 4) * 0.04);
    this.prompt.alpha = 0.6 + 0.4 * Math.abs(Math.sin(this.time * 2));
    // A short pause so the key that ended the battle doesn't skip this screen.
    if (this.time > 1 && this.game.input.wasPressed('confirm')) this.onClose();
  }
}
