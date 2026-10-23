import { Sprite } from 'pixi.js';
import { audio } from '../audio';
import { SPECIES } from '../data/species';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../engine/Game';
import { Scene } from '../engine/Scene';
import { textSprite } from '../gen/font';
import { PALETTE } from '../gen/palette';
import { catchOrb, titleBackdrop } from '../gen/title';
import { type GameState, newGameState } from '../state/GameState';
import { deleteSave, loadGame } from '../state/save';
import { ChoiceMenu } from '../ui/ChoiceMenu';
import { formatPlayTime } from './EndScene';
import { OverworldScene } from './OverworldScene';

const MENU_Y = 108;

export class TitleScene extends Scene {
  private time = 0;
  private prompt!: Sprite;
  private orb!: Sprite;
  private menu = new ChoiceMenu();
  private save: GameState | null = null;
  private info: Sprite | null = null;

  enter(): void {
    audio.music('title');
    this.save = loadGame();
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

    const hint = textSprite('M: sound on/off', { color: PALETTE.cream, shadow: PALETTE.ink });
    hint.position.set(VIEW_WIDTH - hint.width - 4, VIEW_HEIGHT - 10);
    this.root.addChild(hint);

    this.root.addChild(this.menu.root);
  }

  update(dt: number): void {
    this.time += dt;
    this.orb.y = 92 + Math.round(Math.sin(this.time * 3) * 2);
    this.orb.rotation = Math.sin(this.time * 1.5) * 0.15;
    const input = this.game.input;
    if (this.menu.active) {
      this.menu.update(input);
      return;
    }
    this.prompt.visible = Math.floor(this.time * 2) % 2 === 0;
    if (!input.wasPressed('confirm')) return;
    if (!this.save) {
      audio.sfx('confirm');
      this.start(newGameState());
      return;
    }
    this.openMainMenu();
  }

  private openMainMenu(): void {
    this.prompt.visible = false;
    this.openMenu([
      { label: 'Continue', onPick: () => this.start(this.save!) },
      { label: 'New Game', onPick: () => this.confirmNewGame() },
    ]);
    this.showInfo(this.saveSummary());
  }

  private confirmNewGame(): void {
    this.openMenu(
      [
        { label: 'Start over', onPick: () => (deleteSave(), this.start(newGameState())) },
        { label: 'Go back', onPick: () => this.openMainMenu() },
      ],
      () => this.openMainMenu(),
    );
    this.showInfo('Start over? Your saved game will be erased.');
  }

  private openMenu(choices: { label: string; onPick: () => void }[], onCancel = () => this.closeMenu()): void {
    this.menu.open(choices, 0, MENU_Y, onCancel);
    this.menu.root.x = Math.floor((VIEW_WIDTH - this.menu.size.w) / 2);
  }

  private closeMenu(): void {
    this.showInfo(null);
  }

  private showInfo(text: string | null): void {
    this.info?.destroy({ texture: true, textureSource: true });
    this.info = null;
    if (!text) return;
    this.info = textSprite(text, { color: PALETTE.cream, shadow: PALETTE.ink });
    this.info.position.set(Math.floor((VIEW_WIDTH - this.info.width) / 2), MENU_Y + this.menu.size.h + 4);
    this.root.addChild(this.info);
  }

  private saveSummary(): string {
    const s = this.save!;
    const lead = s.party[0];
    const parts = [lead ? `${SPECIES[lead.species].name} Lv${lead.level}` : 'No monsters yet', formatPlayTime(s.stats.playSeconds)];
    if (s.flags.badge) parts.push('Badge');
    return parts.join('  -  ');
  }

  private start(state: GameState): void {
    this.game.state = state;
    this.game.setScene(new OverworldScene(this.game));
  }
}
