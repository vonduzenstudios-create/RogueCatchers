import { MOVES, type MoveData, type MoveId, type StatStage, type StatusEffect } from '../data/moves';
import { SPECIES } from '../data/species';
import { effectiveness } from '../data/typeChart';
import type { Rng } from '../engine/rng';
import { type Monster, type Stats, gainXp, statsOf, xpReward } from './monster';

/*
 * Turn-based battle rules, kept free of rendering so they can be unit
 * tested. Every action resolves immediately and returns a list of events;
 * the battle scene plays those events back with text and animation.
 */

export type Side = 'player' | 'foe';
export type Outcome = 'win' | 'lose' | 'run' | 'caught';

export type BattleEvent =
  | { kind: 'text'; text: string }
  | { kind: 'attack'; side: Side; move: MoveId }
  | { kind: 'hit'; side: Side; damage: number; hp: number; effectiveness: number; crit: boolean }
  | { kind: 'statusDamage'; side: Side; status: StatusEffect; hp: number }
  | { kind: 'status'; side: Side; status: StatusEffect | null }
  | { kind: 'stat'; side: Side; stat: StatStage; stages: number }
  | { kind: 'heal'; side: Side; hp: number }
  | { kind: 'faint'; side: Side }
  | { kind: 'sendOut'; side: Side; index: number }
  | { kind: 'xp'; amount: number; xp: number }
  | { kind: 'levelUp'; level: number; learned: MoveId[] }
  | { kind: 'throwOrb' }
  | { kind: 'shake' }
  | { kind: 'breakFree' }
  | { kind: 'caught' }
  | { kind: 'end'; outcome: Outcome };

export interface Inventory {
  potion: number;
  catchOrb: number;
}

export interface BattleSetup {
  playerParty: Monster[];
  foeParty: Monster[];
  inventory: Inventory;
  rng: Rng;
  /** Set for trainer battles: no running, no catching. */
  trainerName?: string;
}

export const POTION_HEAL = 20;

const STATUS_NAMES: Record<StatusEffect, string> = {
  burn: 'was burned',
  poison: 'was poisoned',
  paralysis: 'is paralyzed',
  sleep: 'fell asleep',
};

interface Combatant {
  party: Monster[];
  active: number;
  stages: Record<StatStage, number>;
  sleepTurns: number;
}

type Action = { kind: 'move'; move: MoveId } | { kind: 'none' };

export class Battle {
  readonly player: Combatant;
  readonly foe: Combatant;
  readonly trainerName?: string;
  outcome: Outcome | null = null;
  /** True when the player's active monster fainted and they must pick another. */
  needsSwitch = false;
  /** The wild monster that was caught, if any. */
  caught: Monster | null = null;
  private inventory: Inventory;
  private rng: Rng;
  /** Monsters on the player's side that took part against the current foe, for sharing XP. */
  private participants = new Set<number>();

  constructor(setup: BattleSetup) {
    this.player = combatant(setup.playerParty);
    this.foe = combatant(setup.foeParty);
    this.inventory = setup.inventory;
    this.rng = setup.rng;
    this.trainerName = setup.trainerName;
    this.player.active = Math.max(0, setup.playerParty.findIndex((m) => m.hp > 0));
    this.participants.add(this.player.active);
  }

  get wild(): boolean {
    return !this.trainerName;
  }

  activeOf(side: Side): Monster {
    const c = this.side(side);
    return c.party[c.active];
  }

  /** Effective stats including stage boosts and status. */
  effectiveStats(side: Side): Stats {
    const c = this.side(side);
    const m = this.activeOf(side);
    const base = statsOf(m);
    return {
      maxHp: base.maxHp,
      attack: Math.floor(base.attack * stageMultiplier(c.stages.attack) * (m.status === 'burn' ? 0.5 : 1)),
      defense: Math.floor(base.defense * stageMultiplier(c.stages.defense)),
      speed: Math.floor(base.speed * stageMultiplier(c.stages.speed) * (m.status === 'paralysis' ? 0.5 : 1)),
    };
  }

  /** Opening lines when the battle starts. */
  intro(): BattleEvent[] {
    const foe = this.activeOf('foe');
    const events: BattleEvent[] = this.wild
      ? [{ kind: 'text', text: `A wild ${SPECIES[foe.species].name} appeared!` }]
      : [
          { kind: 'text', text: `${this.trainerName} wants to battle!` },
          { kind: 'text', text: `${this.trainerName} sent out ${SPECIES[foe.species].name}!` },
        ];
    events.push({ kind: 'text', text: `Go, ${SPECIES[this.activeOf('player').species].name}!` });
    return events;
  }

  // ---- Player actions ---------------------------------------------------

  fight(moveIndex: number): BattleEvent[] {
    const move = this.activeOf('player').moves[moveIndex];
    if (!move) throw new Error(`No move in slot ${moveIndex}`);
    return this.runTurn({ kind: 'move', move });
  }

  usePotion(): BattleEvent[] {
    if (this.inventory.potion <= 0) return [{ kind: 'text', text: 'You have no Potions left.' }];
    const m = this.activeOf('player');
    const max = statsOf(m).maxHp;
    if (m.hp >= max) return [{ kind: 'text', text: `${SPECIES[m.species].name} is already at full health.` }];
    this.inventory.potion--;
    m.hp = Math.min(max, m.hp + POTION_HEAL);
    const events: BattleEvent[] = [
      { kind: 'text', text: `You used a Potion.` },
      { kind: 'heal', side: 'player', hp: m.hp },
    ];
    return [...events, ...this.runTurn({ kind: 'none' })];
  }

  throwOrb(): BattleEvent[] {
    if (!this.wild) return [{ kind: 'text', text: "You can't catch another trainer's monster!" }];
    if (this.inventory.catchOrb <= 0) return [{ kind: 'text', text: 'You have no Catch Orbs left.' }];
    this.inventory.catchOrb--;
    const foe = this.activeOf('foe');
    const events: BattleEvent[] = [{ kind: 'text', text: 'You threw a Catch Orb!' }, { kind: 'throwOrb' }];
    const shakes = this.catchShakes(foe);
    for (let i = 0; i < Math.min(shakes, 3); i++) events.push({ kind: 'shake' });
    if (shakes >= 4) {
      this.caught = foe;
      this.outcome = 'caught';
      events.push({ kind: 'caught' }, { kind: 'text', text: `Gotcha! ${SPECIES[foe.species].name} was caught!` });
      events.push({ kind: 'end', outcome: 'caught' });
      return events;
    }
    events.push({ kind: 'breakFree' }, { kind: 'text', text: shakes === 0 ? 'Oh no! It broke free!' : 'Argh! So close!' });
    return [...events, ...this.runTurn({ kind: 'none' })];
  }

  run(): BattleEvent[] {
    if (!this.wild) return [{ kind: 'text', text: "You can't run from a trainer battle!" }];
    const mine = this.effectiveStats('player').speed;
    const theirs = this.effectiveStats('foe').speed;
    if (mine >= theirs || this.rng.chance(0.5 + (mine / Math.max(1, theirs)) * 0.3)) {
      this.outcome = 'run';
      return [{ kind: 'text', text: 'Got away safely!' }, { kind: 'end', outcome: 'run' }];
    }
    return [{ kind: 'text', text: "Couldn't get away!" }, ...this.runTurn({ kind: 'none' })];
  }

  /** Swap the active monster. Free after a faint; otherwise the foe gets a turn. */
  switchTo(index: number): BattleEvent[] {
    const target = this.player.party[index];
    if (!target || target.hp <= 0 || index === this.player.active) return [];
    const forced = this.needsSwitch;
    const leaving = this.activeOf('player');
    this.player.active = index;
    this.player.stages = { attack: 0, defense: 0, speed: 0 };
    this.player.sleepTurns = target.status === 'sleep' ? Math.max(1, this.player.sleepTurns) : 0;
    this.participants.add(index);
    this.needsSwitch = false;
    const events: BattleEvent[] = [];
    if (!forced) events.push({ kind: 'text', text: `${SPECIES[leaving.species].name}, come back!` });
    events.push({ kind: 'sendOut', side: 'player', index }, { kind: 'text', text: `Go, ${SPECIES[target.species].name}!` });
    return forced ? events : [...events, ...this.runTurn({ kind: 'none' })];
  }

  // ---- Turn resolution --------------------------------------------------

  private runTurn(playerAction: Action): BattleEvent[] {
    const events: BattleEvent[] = [];
    const foeAction: Action = { kind: 'move', move: this.chooseFoeMove() };
    const playerFirst = this.playerMovesFirst(playerAction);
    const order: [Side, Action][] = playerFirst
      ? [['player', playerAction], ['foe', foeAction]]
      : [['foe', foeAction], ['player', playerAction]];

    for (const [side, action] of order) {
      if (this.outcome || this.needsSwitch) break;
      if (action.kind !== 'move' || this.activeOf(side).hp <= 0) continue;
      events.push(...this.useMove(side, action.move));
      if (this.handleFaints(events)) break;
    }
    if (!this.outcome && !this.needsSwitch) {
      for (const side of ['player', 'foe'] as Side[]) {
        events.push(...this.endOfTurnDamage(side));
        if (this.handleFaints(events)) break;
      }
    }
    return events;
  }

  private playerMovesFirst(playerAction: Action): boolean {
    if (playerAction.kind !== 'move') return true;
    const mine = this.effectiveStats('player').speed;
    const theirs = this.effectiveStats('foe').speed;
    return mine === theirs ? this.rng.chance(0.5) : mine > theirs;
  }

  private useMove(side: Side, moveId: MoveId): BattleEvent[] {
    const events: BattleEvent[] = [];
    const user = this.activeOf(side);
    const c = this.side(side);
    const name = this.label(side);

    if (user.status === 'sleep') {
      if (c.sleepTurns > 0) {
        c.sleepTurns--;
        return [{ kind: 'text', text: `${name} is fast asleep.` }];
      }
      user.status = null;
      events.push({ kind: 'status', side, status: null }, { kind: 'text', text: `${name} woke up!` });
    }
    if (user.status === 'paralysis' && this.rng.chance(0.25)) {
      return [{ kind: 'text', text: `${name} is paralyzed! It can't move!` }];
    }

    const move = MOVES[moveId];
    events.push({ kind: 'text', text: `${name} used ${move.name}!` }, { kind: 'attack', side, move: moveId });
    const targetSide: Side = side === 'player' ? 'foe' : 'player';
    if (!this.rng.chance(move.accuracy / 100)) {
      events.push({ kind: 'text', text: `${name}'s attack missed!` });
      return events;
    }

    if (move.power > 0) events.push(...this.dealDamage(side, targetSide, move));
    if (move.inflicts && this.activeOf(targetSide).hp > 0) events.push(...this.tryInflict(targetSide, move));
    if (move.boost) events.push(...this.applyBoost(move.boost.target === 'self' ? side : targetSide, move));
    return events;
  }

  private dealDamage(side: Side, targetSide: Side, move: MoveData): BattleEvent[] {
    const user = this.activeOf(side);
    const target = this.activeOf(targetSide);
    const crit = this.rng.chance(1 / 16);
    const eff = effectiveness(move.type, SPECIES[target.species].type);
    const damage = computeDamage({
      level: user.level,
      power: move.power,
      attack: this.effectiveStats(side).attack,
      defense: this.effectiveStats(targetSide).defense,
      stab: SPECIES[user.species].type === move.type,
      effectiveness: eff,
      crit,
      roll: this.rng.range(0.85, 1),
    });
    target.hp = Math.max(0, target.hp - damage);
    const events: BattleEvent[] = [{ kind: 'hit', side: targetSide, damage, hp: target.hp, effectiveness: eff, crit }];
    if (crit) events.push({ kind: 'text', text: 'A critical hit!' });
    if (eff > 1) events.push({ kind: 'text', text: "It's super effective!" });
    if (eff < 1) events.push({ kind: 'text', text: "It's not very effective..." });
    return events;
  }

  private tryInflict(targetSide: Side, move: MoveData): BattleEvent[] {
    const target = this.activeOf(targetSide);
    const effect = move.inflicts!;
    const name = this.label(targetSide);
    if (target.status) return move.power === 0 ? [{ kind: 'text', text: 'But it failed!' }] : [];
    if (!this.rng.chance(effect.chance / 100)) return [];
    target.status = effect.status;
    if (effect.status === 'sleep') this.side(targetSide).sleepTurns = this.rng.int(1, 3);
    return [
      { kind: 'status', side: targetSide, status: effect.status },
      { kind: 'text', text: `${name} ${STATUS_NAMES[effect.status]}!` },
    ];
  }

  private applyBoost(side: Side, move: MoveData): BattleEvent[] {
    const { stat, stages } = move.boost!;
    const c = this.side(side);
    const name = this.label(side);
    const statName = stat === 'attack' ? 'Attack' : stat === 'defense' ? 'Defense' : 'Speed';
    const next = Math.max(-6, Math.min(6, c.stages[stat] + stages));
    if (next === c.stages[stat]) return [{ kind: 'text', text: `${name}'s ${statName} won't go any ${stages > 0 ? 'higher' : 'lower'}!` }];
    c.stages[stat] = next;
    return [
      { kind: 'stat', side, stat, stages },
      { kind: 'text', text: `${name}'s ${statName} ${stages > 0 ? 'rose' : 'fell'}!` },
    ];
  }

  private endOfTurnDamage(side: Side): BattleEvent[] {
    const m = this.activeOf(side);
    if (m.hp <= 0 || (m.status !== 'burn' && m.status !== 'poison')) return [];
    const max = statsOf(m).maxHp;
    const damage = Math.max(1, Math.floor(max / (m.status === 'burn' ? 16 : 8)));
    m.hp = Math.max(0, m.hp - damage);
    return [
      { kind: 'text', text: `${this.label(side)} is hurt by its ${m.status}!` },
      { kind: 'statusDamage', side, status: m.status, hp: m.hp },
    ];
  }

  /** Resolve fainted monsters. Returns true if the turn must stop. */
  private handleFaints(events: BattleEvent[]): boolean {
    let stop = false;
    const foe = this.activeOf('foe');
    if (foe.hp <= 0) {
      stop = true;
      events.push({ kind: 'faint', side: 'foe' }, { kind: 'text', text: `${this.label('foe')} fainted!` });
      events.push(...this.awardXp(foe));
      const next = this.foe.party.findIndex((m) => m.hp > 0);
      if (next === -1) {
        this.outcome = 'win';
        events.push({ kind: 'end', outcome: 'win' });
        return true;
      }
      this.foe.active = next;
      this.foe.stages = { attack: 0, defense: 0, speed: 0 };
      this.foe.sleepTurns = 0;
      this.participants = new Set([this.player.active]);
      events.push(
        { kind: 'sendOut', side: 'foe', index: next },
        { kind: 'text', text: `${this.trainerName} sent out ${SPECIES[this.foe.party[next].species].name}!` },
      );
    }
    const mine = this.activeOf('player');
    if (mine.hp <= 0) {
      stop = true;
      events.push({ kind: 'faint', side: 'player' }, { kind: 'text', text: `${SPECIES[mine.species].name} fainted!` });
      if (this.player.party.every((m) => m.hp <= 0)) {
        this.outcome = 'lose';
        events.push({ kind: 'text', text: 'You have no monsters left to fight!' }, { kind: 'end', outcome: 'lose' });
      } else {
        this.needsSwitch = true;
      }
    }
    return stop;
  }

  /** Split experience between every healthy monster that fought this foe. */
  private awardXp(foe: Monster): BattleEvent[] {
    const events: BattleEvent[] = [];
    const earners = [...this.participants].filter((i) => this.player.party[i].hp > 0);
    if (earners.length === 0) return events;
    const share = Math.max(1, Math.floor(xpReward(foe, !this.wild) / earners.length));
    for (const i of earners) {
      const m = this.player.party[i];
      const name = SPECIES[m.species].name;
      const levels = gainXp(m, share);
      events.push({ kind: 'text', text: `${name} gained ${share} XP!` });
      if (i === this.player.active) events.push({ kind: 'xp', amount: share, xp: m.xp });
      for (const lv of levels) {
        events.push({ kind: 'levelUp', level: lv.newLevel, learned: lv.learned });
        events.push({ kind: 'text', text: `${name} grew to level ${lv.newLevel}!` });
        for (const move of lv.learned) events.push({ kind: 'text', text: `${name} learned ${MOVES[move].name}!` });
      }
    }
    return events;
  }

  // ---- Foe AI and catching ----------------------------------------------

  /** Mostly picks the move that does the most good, sometimes a random one. */
  chooseFoeMove(): MoveId {
    const foe = this.activeOf('foe');
    const target = this.activeOf('player');
    if (this.rng.chance(0.25)) return this.rng.pick(foe.moves);
    let best = foe.moves[0];
    let bestScore = -Infinity;
    for (const id of foe.moves) {
      const move = MOVES[id];
      let score: number;
      if (move.power > 0) {
        const stab = SPECIES[foe.species].type === move.type ? 1.5 : 1;
        score = move.power * stab * effectiveness(move.type, SPECIES[target.species].type) * (move.accuracy / 100);
      } else if (move.inflicts) {
        score = target.status ? 0 : 45 * (move.accuracy / 100);
      } else {
        const c = move.boost!.target === 'self' ? this.foe : this.player;
        score = Math.abs(c.stages[move.boost!.stat]) >= 2 ? 0 : 30;
      }
      score += this.rng.range(0, 10);
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return best;
  }

  /** 0 to 3 shakes then breaks free; 4 means caught. */
  private catchShakes(foe: Monster): number {
    const p = catchChance(foe);
    // Four independent checks whose combined odds equal p.
    const perShake = Math.pow(p, 1 / 4);
    for (let i = 0; i < 4; i++) if (!this.rng.chance(perShake)) return i;
    return 4;
  }

  private side(side: Side): Combatant {
    return side === 'player' ? this.player : this.foe;
  }

  private label(side: Side): string {
    const name = SPECIES[this.activeOf(side).species].name;
    if (side === 'player') return name;
    return this.wild ? `Wild ${name}` : `Foe ${name}`;
  }
}

function combatant(party: Monster[]): Combatant {
  return { party, active: 0, stages: { attack: 0, defense: 0, speed: 0 }, sleepTurns: 0 };
}

export function stageMultiplier(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

export interface DamageInput {
  level: number;
  power: number;
  attack: number;
  defense: number;
  stab: boolean;
  effectiveness: number;
  crit: boolean;
  /** Random spread, 0.85 to 1. */
  roll: number;
}

export function computeDamage(d: DamageInput): number {
  const base = Math.floor((((2 * d.level) / 5 + 2) * d.power * d.attack) / d.defense / 50) + 2;
  const total = base * (d.stab ? 1.5 : 1) * d.effectiveness * (d.crit ? 1.5 : 1) * d.roll;
  return Math.max(1, Math.floor(total));
}

/** Probability (0 to 1) that a Catch Orb holds, given the target's HP, status and species. */
export function catchChance(m: Monster): number {
  const max = statsOf(m).maxHp;
  const statusBonus = m.status === 'sleep' ? 2 : m.status ? 1.5 : 1;
  const a = (((3 * max - 2 * m.hp) * SPECIES[m.species].catchRate) / (3 * max)) * statusBonus;
  return Math.min(1, a / 255);
}
