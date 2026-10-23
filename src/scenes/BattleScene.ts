import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { audio } from '../audio';
import { Battle, type BattleEvent, type Outcome, type Side } from '../battle/Battle';
import { type Monster, statsOf, xpForLevel } from '../battle/monster';
import { MOVES } from '../data/moves';
import { SPECIES, type SpeciesId } from '../data/species';
import { TYPE_COLORS } from '../data/types';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../engine/Game';
import type { Action as InputAction } from '../engine/Input';
import { Scene } from '../engine/Scene';
import type { Game } from '../engine/Game';
import { type Arena, drawBattleBackdrop } from '../gen/battleArt';
import { textSprite } from '../gen/font';
import { generateMonster } from '../gen/monsters';
import { PALETTE } from '../gen/palette';
import { drawCatchOrb } from '../gen/title';
import { drawFrame } from '../gen/ui';
import { DialogueBox } from '../ui/DialogueBox';

/** Seconds a battle message stays up before moving on by itself. */
const TEXT_AUTO = 1.1;
const FOE_POS = { x: 236, y: 90 };
const PLAYER_POS = { x: 84, y: 131 };

const monsterTextures = new Map<SpeciesId, { front: Texture[]; back: Texture[] }>();
function texturesFor(id: SpeciesId): { front: Texture[]; back: Texture[] } {
  let t = monsterTextures.get(id);
  if (!t) {
    const art = generateMonster(id);
    t = { front: art.front.map((c) => c.toTexture()), back: art.back.map((c) => c.toTexture()) };
    monsterTextures.set(id, t);
  }
  return t;
}

/** A unit of animation; `update` returns true when finished. */
interface Task {
  update(dt: number): boolean;
}

type Mode = 'events' | 'action' | 'moves' | 'bag' | 'party';

interface MenuOption {
  label: string;
  enabled: boolean;
  onPick: () => void;
}

export interface BattleOptions {
  arena: Arena;
  onEnd: (outcome: Outcome, battle: Battle) => void;
}

/** Plays a Battle: animates its events and runs the Fight / Bag / Party / Run menus. */
export class BattleScene extends Scene {
  private dialogue = new DialogueBox();
  private field = new Container();
  private ui = new Container();
  private menu = new Container();
  private foeSprite!: Sprite;
  private playerSprite!: Sprite;
  private orb: Sprite | null = null;
  private effects = new Graphics();
  private foeBox!: StatusBox;
  private playerBox!: StatusBox;
  private queue: BattleEvent[] = [];
  private task: Task | null = null;
  private mode: Mode = 'events';
  private cursor = 0;
  private options: MenuOption[] = [];
  private time = 0;
  private ended = false;

  constructor(
    game: Game,
    private battle: Battle,
    private opts: BattleOptions,
  ) {
    super(game);
  }

  enter(): void {
    this.root.addChild(new Sprite(drawBattleBackdrop(VIEW_WIDTH, VIEW_HEIGHT - 48, this.opts.arena).toTexture()));
    this.root.addChild(this.field);
    this.field.addChild(this.effects);

    this.foeSprite = new Sprite();
    this.foeSprite.anchor.set(0.5, 1);
    this.foeSprite.position.set(FOE_POS.x, FOE_POS.y);
    this.playerSprite = new Sprite();
    this.playerSprite.anchor.set(0.5, 1);
    this.playerSprite.position.set(PLAYER_POS.x, PLAYER_POS.y);
    this.field.addChild(this.foeSprite, this.playerSprite);
    this.setMonsterSprite('foe');
    this.setMonsterSprite('player');

    this.foeBox = new StatusBox(false);
    this.foeBox.root.position.set(6, 8);
    this.playerBox = new StatusBox(true);
    this.playerBox.root.position.set(VIEW_WIDTH - 136, 86);
    this.ui.addChild(this.foeBox.root, this.playerBox.root);
    this.foeBox.set(this.battle.activeOf('foe'));
    this.playerBox.set(this.battle.activeOf('player'));
    this.root.addChild(this.ui);

    const bottom = new Graphics().rect(0, VIEW_HEIGHT - 48, VIEW_WIDTH, 48).fill(0x1b1f3b);
    this.root.addChild(bottom);
    this.root.addChild(this.dialogue.root);
    this.root.addChild(this.menu);

    const trainer = this.battle.trainerName;
    audio.music(!trainer ? 'battle' : trainer.startsWith('Leader') ? 'leader' : 'trainer');
    this.play(this.battle.intro());
  }

  update(dt: number): void {
    this.time += dt;
    this.idleBob();
    const input = this.game.input;

    if (this.task) {
      if (this.task.update(dt)) this.task = null;
      return;
    }
    if (this.dialogue.active) {
      this.dialogue.update(dt, input);
      return;
    }
    if (this.mode === 'events') {
      this.nextEvent();
      return;
    }
    this.dialogue.update(dt, input);
    this.updateMenu(input);
  }

  // ---- Event playback ---------------------------------------------------

  private play(events: BattleEvent[]): void {
    this.closeMenu();
    this.queue.push(...events);
    this.mode = 'events';
  }

  private nextEvent(): void {
    const e = this.queue.shift();
    if (!e) {
      this.afterEvents();
      return;
    }
    switch (e.kind) {
      case 'text':
        this.dialogue.show([e.text], undefined, undefined, { autoAdvance: TEXT_AUTO });
        break;
      case 'attack':
        if (MOVES[e.move].power > 0) audio.sfx('attack');
        this.task = this.attackTask(e.side, TYPE_COLORS[MOVES[e.move].type], MOVES[e.move].power > 0);
        break;
      case 'hit':
        audio.sfx(e.effectiveness > 1 || e.crit ? 'hitSuper' : e.effectiveness < 1 ? 'hitWeak' : 'hit');
        this.task = sequence(this.blinkTask(e.side), this.hpTask(e.side, e.hp));
        break;
      case 'statusDamage':
        audio.sfx('hitWeak');
        this.task = sequence(this.blinkTask(e.side), this.hpTask(e.side, e.hp));
        break;
      case 'heal':
        audio.sfx('potion');
        this.task = this.hpTask(e.side, e.hp);
        break;
      case 'status':
        this.boxOf(e.side).setStatus(e.status);
        break;
      case 'stat':
        audio.sfx(e.stages > 0 ? 'statUp' : 'statDown');
        this.task = this.statTask(e.side, e.stages > 0);
        break;
      case 'faint':
        audio.sfx('faint');
        if (e.side === 'foe' && this.battle.foe.party.every((m) => m.hp <= 0)) audio.music('victory');
        this.task = this.faintTask(e.side);
        break;
      case 'sendOut':
        this.setMonsterSprite(e.side);
        this.boxOf(e.side).set(this.battle.activeOf(e.side));
        this.task = this.appearTask(e.side);
        break;
      case 'xp':
        this.task = this.xpTask();
        break;
      case 'levelUp':
        audio.sfx('levelUp');
        this.playerBox.set(this.battle.activeOf('player'));
        break;
      case 'throwOrb':
        audio.sfx('throw');
        this.task = this.throwTask();
        break;
      case 'shake':
        audio.sfx('shake');
        this.task = this.shakeTask();
        break;
      case 'breakFree':
        audio.sfx('breakFree');
        this.task = this.breakFreeTask();
        break;
      case 'caught':
        audio.music('victory');
        this.task = this.caughtTask();
        break;
      case 'end':
        this.finish(e.outcome);
        break;
    }
  }

  private afterEvents(): void {
    if (this.ended) return;
    if (this.battle.needsSwitch) this.openParty(true);
    else this.openActions();
  }

  private finish(outcome: Outcome): void {
    this.ended = true;
    this.queue = [];
    this.task = sequence(timer(0.6), {
      update: () => {
        this.opts.onEnd(outcome, this.battle);
        return true;
      },
    });
  }

  // ---- Menus ------------------------------------------------------------

  private openActions(): void {
    const name = SPECIES[this.battle.activeOf('player').species].name;
    this.dialogue.show([`What will ${name} do?`], undefined, undefined, { hold: true });
    this.showMenu('action', [
      { label: 'Fight', enabled: true, onPick: () => this.openMoves() },
      { label: 'Bag', enabled: true, onPick: () => this.openBag() },
      { label: 'Party', enabled: true, onPick: () => this.openParty(false) },
      { label: 'Run', enabled: this.battle.wild, onPick: () => this.play(this.battle.run()) },
    ]);
  }

  private openMoves(): void {
    this.dialogue.hide();
    const m = this.battle.activeOf('player');
    this.showMenu(
      'moves',
      m.moves.map((id, i) => ({ label: MOVES[id].name, enabled: true, onPick: () => this.play(this.battle.fight(i)) })),
    );
  }

  private openBag(): void {
    this.dialogue.hide();
    const inv = this.game.state.inventory;
    this.showMenu('bag', [
      { label: `Potion x${inv.potion}`, enabled: inv.potion > 0, onPick: () => this.play(this.battle.usePotion()) },
      {
        label: `Catch Orb x${inv.catchOrb}`,
        enabled: inv.catchOrb > 0 && this.battle.wild,
        onPick: () => this.play(this.battle.throwOrb()),
      },
    ]);
  }

  private openParty(forced: boolean): void {
    this.dialogue.show([forced ? 'Choose your next monster.' : 'Switch to which monster?'], undefined, undefined, { hold: true });
    const party = this.battle.player.party;
    this.showMenu(
      'party',
      party.map((m, i) => ({
        label: `${SPECIES[m.species].name} Lv${m.level} ${m.hp}/${statsOf(m).maxHp}`,
        enabled: m.hp > 0 && i !== this.battle.player.active,
        onPick: () => this.play(this.battle.switchTo(i)),
      })),
    );
  }

  private showMenu(mode: Mode, options: MenuOption[]): void {
    this.mode = mode;
    this.options = options;
    this.cursor = Math.max(0, options.findIndex((o) => o.enabled));
    this.renderMenu();
  }

  private closeMenu(): void {
    this.menu.removeChildren().forEach((c) => c.destroy({ children: true, texture: true, textureSource: true }));
    this.dialogue.hide();
  }

  /** Two-column grid for actions and moves, one column for the bag and party. */
  private get columns(): number {
    return this.mode === 'action' || this.mode === 'moves' ? 2 : 1;
  }

  private renderMenu(): void {
    this.menu.removeChildren().forEach((c) => c.destroy({ children: true, texture: true, textureSource: true }));
    const wide = this.mode !== 'action';
    const w = this.mode === 'action' ? 120 : this.mode === 'moves' ? 210 : 200;
    const x = this.mode === 'action' ? VIEW_WIDTH - w - 4 : 4;
    const rows = Math.ceil(this.options.length / this.columns);
    const h = Math.max(46, rows * 12 + 12);
    const box = new Sprite(drawFrame(w, h).toTexture());
    box.position.set(x, VIEW_HEIGHT - h - 4);
    this.menu.addChild(box);

    const colW = (w - 16) / this.columns;
    this.options.forEach((o, i) => {
      const col = i % this.columns;
      const row = Math.floor(i / this.columns);
      const item = new Container();
      item.position.set(10 + col * colW, 8 + row * 12);
      const label = textSprite(o.label, { color: o.enabled ? PALETTE.ink : '#9a95a0' });
      label.x = 8;
      item.addChild(label);
      if (i === this.cursor) item.addChild(textSprite('>', { color: '#d9483b' }));
      // Mouse and touch: tap an option to pick it.
      item.eventMode = 'static';
      item.cursor = 'pointer';
      item.hitArea = { contains: (px: number, py: number) => px >= 0 && px < colW && py >= -2 && py < 10 };
      item.on('pointertap', () => {
        this.cursor = i;
        this.pick();
      });
      box.addChild(item);
    });

    if (this.mode === 'moves') this.renderMoveInfo();
    if (wide && this.mode !== 'moves') {
      const hint = textSprite('X: back', { color: '#9a95a0' });
      hint.position.set(w - hint.width - 8, h - 13);
      box.addChild(hint);
    }
  }

  private renderMoveInfo(): void {
    const id = this.battle.activeOf('player').moves[this.cursor];
    if (!id) return;
    const move = MOVES[id];
    const info = new Sprite(drawFrame(98, 46).toTexture());
    info.position.set(VIEW_WIDTH - 102, VIEW_HEIGHT - 50);
    const type = textSprite(move.type, { color: PALETTE.white, outline: TYPE_COLORS[move.type] });
    type.position.set(8, 7);
    const power = textSprite(move.power > 0 ? `Power ${move.power}` : 'Status', { color: PALETTE.ink });
    power.position.set(8, 19);
    const acc = textSprite(`Acc ${move.accuracy}`, { color: PALETTE.ink });
    acc.position.set(8, 30);
    info.addChild(type, power, acc);
    this.menu.addChild(info);
  }

  private updateMenu(input: { wasPressed(a: InputAction): boolean }): void {
    const n = this.options.length;
    const cols = this.columns;
    let moved = false;
    const go = (delta: number) => {
      const next = this.cursor + delta;
      if (next >= 0 && next < n) {
        this.cursor = next;
        moved = true;
      }
    };
    if (input.wasPressed('up')) go(-cols);
    if (input.wasPressed('down')) go(cols);
    if (cols > 1 && input.wasPressed('left') && this.cursor % cols > 0) go(-1);
    if (cols > 1 && input.wasPressed('right') && this.cursor % cols < cols - 1) go(1);
    if (moved) {
      audio.sfx('cursor');
      this.renderMenu();
    }

    if (input.wasPressed('confirm')) this.pick();
    else if (input.wasPressed('cancel') && this.mode !== 'action' && !(this.mode === 'party' && this.battle.needsSwitch)) {
      audio.sfx('cancel');
      this.closeMenu();
      this.openActions();
    }
  }

  private pick(): void {
    const option = this.options[this.cursor];
    if (!option?.enabled) return;
    audio.sfx('confirm');
    option.onPick();
  }

  // ---- Sprites and animation --------------------------------------------

  private setMonsterSprite(side: Side): void {
    const m = this.battle.activeOf(side);
    const tex = texturesFor(m.species);
    const sprite = side === 'foe' ? this.foeSprite : this.playerSprite;
    sprite.texture = side === 'foe' ? tex.front[0] : tex.back[0];
    sprite.alpha = 1;
    sprite.scale.set(1);
    sprite.position.set(side === 'foe' ? FOE_POS.x : PLAYER_POS.x, side === 'foe' ? FOE_POS.y : PLAYER_POS.y);
  }

  private idleBob(): void {
    const frame = Math.floor(this.time * 2) % 2;
    for (const side of ['foe', 'player'] as Side[]) {
      const m = this.battle.activeOf(side);
      if (m.hp <= 0) continue;
      const tex = texturesFor(m.species);
      const sprite = side === 'foe' ? this.foeSprite : this.playerSprite;
      if (sprite.alpha > 0 && sprite.scale.x === 1) sprite.texture = side === 'foe' ? tex.front[frame] : tex.back[frame];
    }
  }

  private boxOf(side: Side): StatusBox {
    return side === 'foe' ? this.foeBox : this.playerBox;
  }

  private spriteOf(side: Side): Sprite {
    return side === 'foe' ? this.foeSprite : this.playerSprite;
  }

  private attackTask(side: Side, color: string, damaging: boolean): Task {
    const sprite = this.spriteOf(side);
    const home = side === 'foe' ? FOE_POS : PLAYER_POS;
    const dir = side === 'foe' ? -1 : 1;
    const target = side === 'foe' ? PLAYER_POS : FOE_POS;
    const particles = Array.from({ length: 10 }, (_, i) => ({ angle: (i / 10) * Math.PI * 2, speed: 18 + (i % 3) * 8 }));
    const lunge = tween(0.24, (t) => {
      const k = Math.sin(t * Math.PI);
      sprite.x = home.x + dir * 12 * k;
      sprite.y = home.y - dir * 6 * k;
    });
    const burst = tween(0.36, (t) => {
      this.effects.clear();
      if (t >= 1) return;
      const cx = target.x;
      const cy = target.y - 30;
      for (const p of particles) {
        const r = p.speed * t;
        const x = cx + Math.cos(p.angle) * r;
        const y = cy + Math.sin(p.angle) * r * 0.7;
        const size = damaging ? 3 : 2;
        this.effects.rect(Math.round(x), Math.round(y), size, size).fill({ color, alpha: 1 - t * 0.6 });
      }
    });
    return sequence(lunge, burst);
  }

  private blinkTask(side: Side): Task {
    const sprite = this.spriteOf(side);
    return tween(0.42, (t) => {
      sprite.visible = t >= 1 || Math.floor(t * 8) % 2 === 0;
    });
  }

  private hpTask(side: Side, hp: number): Task {
    const box = this.boxOf(side);
    const from = box.shownHp;
    return tween(0.5, (t) => box.setHp(Math.round(from + (hp - from) * t)));
  }

  private statTask(side: Side, up: boolean): Task {
    const sprite = this.spriteOf(side);
    return tween(0.45, (t) => {
      sprite.tint = t >= 1 ? 0xffffff : Math.floor(t * 6) % 2 === 0 ? (up ? 0xff9c7a : 0x8fa2d8) : 0xffffff;
    });
  }

  private faintTask(side: Side): Task {
    const sprite = this.spriteOf(side);
    const startY = sprite.y;
    return tween(0.5, (t) => {
      sprite.y = startY + 30 * t;
      sprite.alpha = 1 - t;
    });
  }

  private appearTask(side: Side): Task {
    const sprite = this.spriteOf(side);
    return tween(0.35, (t) => {
      sprite.scale.set(Math.max(0.05, t));
      sprite.alpha = t;
      if (t >= 1) sprite.scale.set(1);
    });
  }

  private xpTask(): Task {
    const m = this.battle.activeOf('player');
    const from = this.playerBox.shownXp;
    const to = xpFraction(m);
    return tween(0.6, (t) => this.playerBox.setXp(to < from ? to : from + (to - from) * t));
  }

  private throwTask(): Task {
    this.orb = new Sprite(drawCatchOrb().toTexture());
    this.orb.anchor.set(0.5);
    this.field.addChild(this.orb);
    const orb = this.orb;
    const foe = this.foeSprite;
    const start = { x: PLAYER_POS.x + 10, y: PLAYER_POS.y - 40 };
    const end = { x: FOE_POS.x, y: FOE_POS.y - 10 };
    const fly = tween(0.55, (t) => {
      orb.position.set(start.x + (end.x - start.x) * t, start.y + (end.y - start.y) * t - Math.sin(t * Math.PI) * 50);
      orb.rotation = t * 10;
    });
    const absorb = tween(0.3, (t) => {
      foe.scale.set(Math.max(0.01, 1 - t));
      foe.alpha = 1 - t;
      orb.rotation = 0;
    });
    return sequence(fly, absorb, timer(0.25));
  }

  private shakeTask(): Task {
    const orb = this.orb!;
    return sequence(
      tween(0.45, (t) => {
        orb.rotation = Math.sin(t * Math.PI * 2) * 0.5;
      }),
      timer(0.35),
    );
  }

  private breakFreeTask(): Task {
    const orb = this.orb!;
    const foe = this.foeSprite;
    return tween(0.3, (t) => {
      foe.scale.set(Math.max(0.01, t));
      foe.alpha = t;
      orb.alpha = 1 - t;
      if (t >= 1) {
        orb.destroy();
        this.orb = null;
        foe.scale.set(1);
      }
    });
  }

  private caughtTask(): Task {
    const orb = this.orb!;
    return tween(0.6, (t) => {
      this.effects.clear();
      if (t >= 1) return;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.6;
        const r = 6 + t * 16;
        this.effects.rect(Math.round(orb.x + Math.cos(a) * r), Math.round(orb.y + Math.sin(a) * r), 2, 2).fill(0xffd84a);
      }
    });
  }
}

// ---- Status boxes -------------------------------------------------------

function xpFraction(m: Monster): number {
  const lo = xpForLevel(m.level);
  const hi = xpForLevel(m.level + 1);
  return hi > lo ? Math.max(0, Math.min(1, (m.xp - lo) / (hi - lo))) : 1;
}

/** Name, level, HP bar (and HP numbers and XP bar for your own monster). */
class StatusBox {
  readonly root = new Container();
  private bars = new Graphics();
  private labels = new Container();
  private statusTag = new Container();
  private monster: Monster | null = null;
  shownHp = 0;
  shownXp = 0;
  private nameWidth = 0;

  constructor(private mine: boolean) {
    const h = mine ? 40 : 30;
    this.root.addChild(new Sprite(drawFrame(130, h).toTexture()), this.labels, this.bars, this.statusTag);
  }

  set(m: Monster): void {
    this.monster = m;
    this.shownHp = m.hp;
    this.shownXp = xpFraction(m);
    this.labels.removeChildren().forEach((c) => c.destroy({ texture: true, textureSource: true }));
    const name = textSprite(SPECIES[m.species].name, { color: PALETTE.ink });
    name.position.set(8, 6);
    const level = textSprite(`Lv${m.level}`, { color: PALETTE.ink });
    level.position.set(122 - level.width, 6);
    const hpLabel = textSprite('HP', { color: '#d9483b' });
    hpLabel.position.set(8, 16);
    this.labels.addChild(name, level, hpLabel);
    this.nameWidth = name.width;
    this.setStatus(m.status);
    this.draw();
  }

  setHp(hp: number): void {
    this.shownHp = hp;
    this.draw();
  }

  setXp(fraction: number): void {
    this.shownXp = fraction;
    this.draw();
  }

  setStatus(status: Monster['status']): void {
    this.statusTag.removeChildren().forEach((c) => c.destroy({ texture: true, textureSource: true }));
    if (!status) return;
    const short = { burn: 'BRN', poison: 'PSN', paralysis: 'PAR', sleep: 'SLP' }[status];
    const color = { burn: '#e8622c', poison: '#9c4ac8', paralysis: '#d0a020', sleep: '#7a8090' }[status];
    const tag = textSprite(short, { color: PALETTE.white, outline: color });
    tag.position.set(8 + this.nameWidth + 4, 5);
    this.statusTag.addChild(tag);
  }

  private draw(): void {
    const m = this.monster;
    if (!m) return;
    const max = statsOf(m).maxHp;
    const frac = Math.max(0, Math.min(1, this.shownHp / max));
    const g = this.bars;
    g.clear();
    g.rect(22, 17, 100, 5).fill(0x3a3a4a);
    const color = frac > 0.5 ? 0x4fc45a : frac > 0.2 ? 0xf2c230 : 0xe0483b;
    g.rect(23, 18, Math.round(98 * frac), 3).fill(color);
    if (this.mine) {
      g.rect(8, 33, 114, 3).fill(0x3a3a4a);
      g.rect(8, 33, Math.round(114 * this.shownXp), 3).fill(0x4aa8e8);
      for (const c of this.labels.children.filter((c) => c.label === 'hpText')) c.destroy({ texture: true, textureSource: true });
      const hpText = textSprite(`${Math.max(0, this.shownHp)}/${max}`, { color: PALETTE.ink });
      hpText.label = 'hpText';
      hpText.position.set(122 - hpText.width, 24);
      this.labels.addChild(hpText);
    }
  }
}

// ---- Tiny tween helpers -------------------------------------------------

function tween(duration: number, apply: (t: number) => void): Task {
  let elapsed = 0;
  return {
    update(dt) {
      elapsed += dt;
      const t = Math.min(1, elapsed / duration);
      apply(t);
      return t >= 1;
    },
  };
}

function timer(duration: number): Task {
  return tween(duration, () => {});
}

function sequence(...tasks: Task[]): Task {
  let i = 0;
  return {
    update(dt) {
      while (i < tasks.length && tasks[i].update(dt)) i++;
      return i >= tasks.length;
    },
  };
}
