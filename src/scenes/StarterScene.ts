import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { SPECIES, type SpeciesId } from '../data/species';
import { TYPE_COLORS } from '../data/types';
import type { Game } from '../engine/Game';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../engine/Game';
import { Scene } from '../engine/Scene';
import { textSprite } from '../gen/font';
import { generateMonster } from '../gen/monsters';
import { PALETTE } from '../gen/palette';
import { drawFrame } from '../gen/ui';
import { ChoiceMenu } from '../ui/ChoiceMenu';
import { DialogueBox } from '../ui/DialogueBox';
import { wrapText } from '../ui/text';

export const STARTERS: SpeciesId[] = ['embrit', 'splashell', 'sproutle'];

/** The professor's table: browse the three starters and pick one. */
export class StarterScene extends Scene {
  private cursor = 1;
  private cards: { root: Container; frames: Texture[]; sprite: Sprite }[] = [];
  private info = new Container();
  private dialogue = new DialogueBox();
  private menu = new ChoiceMenu();
  private time = 0;

  constructor(
    game: Game,
    private onChoose: (species: SpeciesId) => void,
  ) {
    super(game);
  }

  enter(): void {
    this.root.addChild(new Graphics().rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT).fill(0x2b2f5e));
    const title = textSprite('Choose your partner!', { color: PALETTE.title, outline: PALETTE.titleOutline });
    title.position.set(Math.floor((VIEW_WIDTH - title.width) / 2), 8);
    this.root.addChild(title);

    STARTERS.forEach((id, i) => {
      const root = new Container();
      root.position.set(16 + i * 100, 24);
      const card = new Sprite(drawFrame(88, 84).toTexture());
      root.addChild(card);
      const art = generateMonster(id);
      const frames = art.front.map((c) => c.toTexture());
      const sprite = new Sprite(frames[0]);
      sprite.position.set(12, 4);
      root.addChild(sprite);
      const name = textSprite(SPECIES[id].name, { color: PALETTE.ink });
      name.position.set(Math.floor((88 - name.width) / 2), 68);
      root.addChild(name);
      root.eventMode = 'static';
      root.cursor = 'pointer';
      root.on('pointertap', () => {
        if (this.menu.active || this.dialogue.active) return;
        this.cursor = i;
        this.refresh();
        this.confirm();
      });
      this.cards.push({ root, frames, sprite });
      this.root.addChild(root);
    });

    this.root.addChild(this.info);
    this.root.addChild(this.dialogue.root);
    this.root.addChild(this.menu.root);
    this.refresh();
  }

  update(dt: number): void {
    this.time += dt;
    const input = this.game.input;
    this.cards.forEach((c, i) => {
      const selected = i === this.cursor;
      c.sprite.texture = c.frames[selected ? Math.floor(this.time * 3) % 2 : 0];
      c.root.y = 24 - (selected ? 3 : 0);
      c.root.alpha = selected ? 1 : 0.7;
    });
    if (this.menu.active) {
      this.menu.update(input);
      return;
    }
    if (this.dialogue.active) {
      this.dialogue.update(dt, input);
      return;
    }
    if (input.wasPressed('left') && this.cursor > 0) {
      this.cursor--;
      this.refresh();
    }
    if (input.wasPressed('right') && this.cursor < STARTERS.length - 1) {
      this.cursor++;
      this.refresh();
    }
    if (input.wasPressed('confirm')) this.confirm();
  }

  private confirm(): void {
    const s = SPECIES[STARTERS[this.cursor]];
    this.dialogue.show([`Choose ${s.name}, the ${s.type} type?`], undefined, () => {
      this.menu.open(
        [
          { label: 'Yes', onPick: () => this.onChoose(s.id) },
          { label: 'No', onPick: () => this.dialogue.hide() },
        ],
        VIEW_WIDTH - 60,
        VIEW_HEIGHT - 86,
        () => this.dialogue.hide(),
      );
    }, { hold: true });
  }

  private refresh(): void {
    for (const c of this.info.removeChildren()) c.destroy({ children: true, texture: true, textureSource: true });
    const s = SPECIES[STARTERS[this.cursor]];
    const box = new Sprite(drawFrame(VIEW_WIDTH - 8, 46).toTexture());
    box.position.set(4, VIEW_HEIGHT - 50);
    const type = textSprite(s.type, { color: PALETTE.white, outline: TYPE_COLORS[s.type] });
    type.position.set(10, 7);
    box.addChild(type);
    wrapText(s.description, VIEW_WIDTH - 28).forEach((line, i) => {
      const desc = textSprite(line, { color: PALETTE.ink });
      desc.position.set(10, 19 + i * 10);
      box.addChild(desc);
    });
    const hint = textSprite('Left/Right to browse, Enter to choose', { color: PALETTE.cream });
    hint.position.set(Math.floor((VIEW_WIDTH - hint.width) / 2), 114);
    this.info.addChild(box, hint);
  }
}
