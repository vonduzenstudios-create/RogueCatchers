import { Sprite } from 'pixi.js';
import { audio } from '../audio';
import { Scene } from '../engine/Scene';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../engine/Game';
import { textSprite } from '../gen/font';
import { PALETTE } from '../gen/palette';
import { catchOrb, titleBackdrop } from '../gen/title';
import { newGameState } from '../state/GameState';
import { OverworldScene } from './OverworldScene';

export class TitleScene extends Scene {
  private time = 0;
  private prompt!: Sprite;
  private orb!: Sprite;

  enter(): void {
    audio.music('title');
    this.root.addChild(new Sprite(titleBackdrop(VIEW_WIDTH, VIEW_HEIGHT)));

    const title = textSprite('RogueCatchers', {
      color: PALETTE.title,
      scale: 2,
      outline: PALETTE.titleOutline,
      shadow: PALETTE.titleShade,
    });
    title.position.set(Math.floor((VIEW_WIDTH - title.width) / 2), 34);
    this.root.addChild(title);

    const subtitle = textSprite('A monster catching tech demo', { color: PALETTE.cream, shadow: PALETTE.ink });
    subtitle.position.set(Math.floor((VIEW_WIDTH - subtitle.width) / 2), 58);
    this.root.addChild(subtitle);

    this.orb = new Sprite(catchOrb());
    this.orb.anchor.set(0.5);
    this.orb.position.set(VIEW_WIDTH / 2, 92);
    this.root.addChild(this.orb);

    this.prompt = textSprite('Press Enter', { color: PALETTE.white, outline: PALETTE.ink });
    this.prompt.position.set(Math.floor((VIEW_WIDTH - this.prompt.width) / 2), 116);
    this.root.addChild(this.prompt);
  }

  update(dt: number): void {
    this.time += dt;
    this.prompt.visible = Math.floor(this.time * 2) % 2 === 0;
    this.orb.y = 92 + Math.round(Math.sin(this.time * 3) * 2);
    this.orb.rotation = Math.sin(this.time * 1.5) * 0.15;

    if (this.game.input.wasPressed('confirm')) {
      audio.sfx('confirm');
      this.game.state = newGameState();
      this.game.setScene(new OverworldScene(this.game));
    }
  }
}
